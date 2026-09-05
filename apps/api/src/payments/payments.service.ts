import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { PaymentMethod, PaymentStatus } from '@prisma/client';
import { DomainError } from '../common/domain-error';
import { ORDER_PAID, type OrderPaidEvent } from '../common/events';
import { PrismaService } from '../prisma/prisma.service';
import { ORDER_EXPIRY_MINUTES } from '../common/order-expiry';
import { reaisToCents } from './amount';
import { MercadoPagoClient, type GatewayPayment } from './gateway';

// approved → pago; rejeições → recusado; devoluções → estornado.
// Estados intermediários (pending, in_process…) são ignorados: nada a persistir.
function mapStatus(gatewayStatus: string): PaymentStatus | null {
  switch (gatewayStatus) {
    case 'approved':
      return 'paid';
    case 'rejected':
    case 'cancelled':
      return 'declined';
    case 'refunded':
    case 'charged_back':
      return 'refunded';
    default:
      return null;
  }
}

export interface ProcessResult {
  outcome:
    | 'became_paid'
    | 'already_processed'
    | 'recorded' // recusado/estornado registrado
    | 'duplicate_payment' // segundo pagamento APROVADO no mesmo pedido: entrou dinheiro 2x
    | 'ignored' // status intermediário ou pedido inexistente
    | 'amount_mismatch'
    | 'lock_timeout'; // nao conseguiu serializar a tempo; nada persistido, o chamador reenvia
  orderId?: string;
}

// Teto de espera pelo lock do pedido (decisao D1.3). Nada dentro da transacao
// faz I/O, entao uma secao critica saudavel leva milissegundos: estourar 3s
// significa anomalia real, e abortar e melhor que segurar a requisicao — o
// webhook do gateway e a reconciliacao reenviam por conta propria.
const LOCK_TIMEOUT_STATEMENT = "SET LOCAL lock_timeout = '3s'";

// Postgres sinaliza estouro de lock_timeout com o SQLSTATE 55P03; o Prisma
// embrulha o erro de query crua, entao checamos meta e mensagem.
function isLockTimeout(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const meta = (error as { meta?: { code?: string } }).meta;
  if (meta?.code === '55P03') return true;
  return /55P03|lock timeout/i.test(String((error as { message?: unknown }).message ?? ''));
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MercadoPagoClient,
    private readonly events: EventEmitter2,
  ) {}

  async createCheckout(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new DomainError('ORDER_NOT_FOUND', 'Pedido não existe.', { orderId });
    }
    if (order.status !== 'pending_payment') {
      throw new DomainError('ORDER_NOT_PAYABLE', 'Pedido não está aguardando pagamento.', {
        orderId,
        status: order.status,
      });
    }
    // Cliente que clica duas vezes não gera duas preferências no gateway
    // (decisão #33): a primeira fica guardada e é devolvida de novo.
    if (order.checkoutInitPoint) {
      this.logger.log(`payment.checkout_reused order=${order.id}`);
      return { initPoint: order.checkoutInitPoint };
    }

    const { initPoint } = await this.gateway.createCheckout({
      orderId: order.id,
      orderNumber: order.number,
      totalCents: order.totalCents,
      orderCreatedAt: order.createdAt,
    });

    // Chamada ao gateway é I/O e não pode acontecer dentro de transação, então
    // dois cliques simultâneos podem criar duas preferências lá. Só a primeira
    // é persistida (updateMany condicionado a NULL) e as duas respostas devolvem
    // a MESMA — a preferência perdedora fica sem uso no gateway, sem efeito.
    const claimed = await this.prisma.order.updateMany({
      where: { id: order.id, checkoutInitPoint: null },
      data: { checkoutInitPoint: initPoint },
    });
    if (claimed.count === 0) {
      const persisted = await this.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      this.logger.log(`payment.checkout_race order=${order.id}`);
      return { initPoint: persisted.checkoutInitPoint ?? initPoint };
    }

    this.logger.log(`payment.checkout_created order=${order.id}`);
    return { initPoint };
  }

  // Idempotente por construção (seção 9.1): unicidade do id da transação
  // garantida pelo banco; processamento em transação; evento publicado UMA vez.
  async processPaymentNotification(gw: GatewayPayment): Promise<ProcessResult> {
    const status = mapStatus(gw.status);
    if (!status) return { outcome: 'ignored' };

    const amountCents = reaisToCents(gw.transactionAmount);

    let result: ProcessResult & { orderNumber?: number };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(LOCK_TIMEOUT_STATEMENT);

        // Serializa POR PEDIDO (decisões D1.1 e D1.2): trava a linha do pedido
        // ANTES de qualquer leitura que decida o desfecho. Sem isto, webhook e
        // reconciliação leem `pending_payment` ao mesmo tempo e ambos publicam
        // order.paid. Quem chega depois espera, relê o estado já commitado e
        // cai em `already_processed`.
        // Pedido inexistente devolve zero linhas — o caminho órfão logo abaixo
        // continua tratando isso.
        if (gw.externalReference) {
          await tx.$queryRaw`SELECT id FROM orders WHERE id = ${gw.externalReference}::uuid FOR UPDATE`;
        }

        // Mesmo webhook repetido: transação já registrada → no-op (um pedido, um alerta).
        const byTransaction = await tx.payment.findUnique({
          where: { gatewayTransactionId: gw.id },
        });
        if (byTransaction) {
          // O estorno chega no MESMO id do pagamento aprovado. Sem este ramo, o
          // curto-circuito de idempotência engolia o estorno e ele nunca era
          // registrado (achado da sessão 07). Mesma transação com status NOVO
          // atualiza a linha; qualquer outra repetição continua sendo no-op.
          if (status === 'refunded' && byTransaction.status !== 'refunded') {
            await tx.payment.update({ where: { id: byTransaction.id }, data: { status } });
            this.logger.warn(
              `payment.refunded order=${byTransaction.orderId} transaction=${gw.id}`,
            );
            return { outcome: 'recorded' as const, orderId: byTransaction.orderId };
          }
          return { outcome: 'already_processed' as const, orderId: byTransaction.orderId };
        }

        const order = gw.externalReference
          ? await tx.order.findUnique({ where: { id: gw.externalReference } })
          : null;
        if (!order) {
          this.logger.error(`payment.orphan_webhook transaction=${gw.id} ref=${gw.externalReference}`);
          return { outcome: 'ignored' as const };
        }

        // Conferência de valor ANTES de confirmar (seção 5.3): divergência não
        // confirma o pedido e registra incidente.
        if (status === 'paid' && amountCents !== order.totalCents) {
          this.logger.error(
            `payment.amount_mismatch order=${order.id} expected=${order.totalCents} received=${amountCents} transaction=${gw.id}`,
          );
          return { outcome: 'amount_mismatch' as const, orderId: order.id };
        }

        // UMA LINHA POR TRANSAÇÃO (decisão #32). O modelo anterior sobrescrevia:
        // a tentativa recusada sumia e o segundo pagamento aprovado não era
        // gravado em lugar nenhum. Agora toda transação vira registro próprio,
        // e a tabela bate 1:1 com o extrato do gateway.
        const alreadyPaid = await tx.payment.findFirst({
          where: { orderId: order.id, status: 'paid' },
        });

        await tx.payment.create({
          data: {
            orderId: order.id,
            method: this.mapMethod(gw),
            status,
            gatewayTransactionId: gw.id,
            amountCents,
          },
        });

        // Dinheiro entrou DUAS vezes no mesmo pedido (ex.: Pix pago e cartão
        // aprovado com atraso). O registro sobrevive e o pedido fica marcado —
        // alguém precisa estornar, e ninguém descobre isso por log.
        if (status === 'paid' && alreadyPaid) {
          this.logger.error(
            `payment.duplicate order=${order.id} first=${alreadyPaid.gatewayTransactionId} second=${gw.id} amount_cents=${amountCents}`,
          );
          return { outcome: 'duplicate_payment' as const, orderId: order.id };
        }

        // Pagamento tardio (decisão #34): o pedido expirado VOLTA para aceite,
        // porque quem pagou está esperando o lanche — mas com marca permanente,
        // já que o aceite é humano e a pessoa precisa saber que é pedido velho.
        if (status === 'paid' && (order.status === 'pending_payment' || order.status === 'expired')) {
          const afterExpiry = order.status === 'expired';
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'awaiting_acceptance',
              ...(afterExpiry ? { paidAfterExpiryAt: new Date() } : {}),
            },
          });
          if (afterExpiry) {
            this.logger.warn(
              `payment.paid_after_expiry order=${order.id} number=${order.number} transaction=${gw.id}`,
            );
          }
          return { outcome: 'became_paid' as const, orderId: order.id, orderNumber: order.number };
        }
        return { outcome: 'recorded' as const, orderId: order.id };
      });
    } catch (error) {
      // Estouro do lock_timeout (decisão D1.3): aborta em vez de segurar a
      // requisição. Nada foi persistido. É seguro porque os dois chamadores
      // reenviam: o controller devolve 503 e o Mercado Pago repete a
      // notificação; a reconciliação passa de novo no ciclo seguinte.
      if (isLockTimeout(error)) {
        this.logger.warn(
          `payment.lock_timeout transaction=${gw.id} ref=${gw.externalReference}`,
        );
        return { outcome: 'lock_timeout' };
      }
      throw error;
    }

    // Evento publicado FORA da transação (só depois do commit) e somente na
    // transição para pago.
    if (result.outcome === 'became_paid' && result.orderId) {
      const payload: OrderPaidEvent = {
        orderId: result.orderId,
        orderNumber: result.orderNumber ?? 0,
      };
      this.events.emit(ORDER_PAID, payload);
      this.logger.log(`order.paid id=${result.orderId} transaction=${gw.id}`);
    }
    return { outcome: result.outcome, orderId: result.orderId };
  }

  // Tipos fora do esperado não podem virar `credit_card` em silêncio: o método
  // gravado errado só aparece na conferência do extrato, meses depois (E3).
  private mapMethod(gw: GatewayPayment): PaymentMethod {
    if (gw.paymentMethodId === 'pix') return 'pix';
    if (gw.paymentTypeId === 'debit_card') return 'debit_card';
    if (gw.paymentTypeId !== 'credit_card') {
      this.logger.warn(
        `payment.unknown_method transaction=${gw.id} payment_method_id=${gw.paymentMethodId} payment_type_id=${gw.paymentTypeId} — gravado como credit_card`,
      );
    }
    // Demais tipos estão excluídos na criação do checkout (gateway.ts).
    return 'credit_card';
  }

  // Reconciliação (seção 9.2): rede de segurança contra webhooks perdidos.
  // Reusa o processamento idempotente do webhook — regularizar um pedido pela
  // reconciliação dispara o mesmo alerta, uma única vez, com atraso.
  // (O agendamento periódico entra quando a lib de scheduler for aprovada;
  // até lá este método é o ponto de entrada.)
  async reconcilePendingOrders(olderThanMinutes = 5, limit = 50) {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    // Limite SUPERIOR de idade (decisão #34): sem ele, pedidos abandonados se
    // acumulam, ocupam os 50 slots e a reconciliação para de enxergar os pedidos
    // novos — degradação silenciosa. O filtro por status já exclui os expirados;
    // a data é a segunda barreira, para o caso de a expiração ainda não ter rodado.
    const floor = new Date(Date.now() - ORDER_EXPIRY_MINUTES * 60 * 1000);
    const pending = await this.prisma.order.findMany({
      where: { status: 'pending_payment', createdAt: { lt: cutoff, gte: floor } },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true },
    });

    let regularized = 0;
    for (const order of pending) {
      try {
        const payments = await this.gateway.searchPaymentsByReference(order.id);
        for (const payment of payments) {
          const result = await this.processPaymentNotification(payment);
          if (result.outcome === 'became_paid') regularized += 1;
        }
      } catch (error) {
        this.logger.error(`payment.reconciliation_failed order=${order.id}: ${String(error)}`);
      }
    }

    if (pending.length > 0) {
      this.logger.log(`payment.reconciliation checked=${pending.length} regularized=${regularized}`);
    }
    return { checked: pending.length, regularized };
  }
}
