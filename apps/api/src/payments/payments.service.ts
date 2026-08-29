import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { PaymentMethod, PaymentStatus } from '@prisma/client';
import { DomainError } from '../common/domain-error';
import { ORDER_PAID, type OrderPaidEvent } from '../common/events';
import { PrismaService } from '../prisma/prisma.service';
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

function mapMethod(gw: GatewayPayment): PaymentMethod {
  if (gw.paymentMethodId === 'pix') return 'pix';
  if (gw.paymentTypeId === 'debit_card') return 'debit_card';
  // Demais tipos estão excluídos na criação do checkout (gateway.ts).
  return 'credit_card';
}

export interface ProcessResult {
  outcome:
    | 'became_paid'
    | 'already_processed'
    | 'recorded' // recusado/estornado registrado
    | 'ignored' // status intermediário ou pedido inexistente
    | 'amount_mismatch';
  orderId?: string;
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
    const { initPoint } = await this.gateway.createCheckout({
      orderId: order.id,
      orderNumber: order.number,
      totalCents: order.totalCents,
    });
    this.logger.log(`payment.checkout_created order=${order.id}`);
    return { initPoint };
  }

  // Idempotente por construção (seção 9.1): unicidade do id da transação
  // garantida pelo banco; processamento em transação; evento publicado UMA vez.
  async processPaymentNotification(gw: GatewayPayment): Promise<ProcessResult> {
    const status = mapStatus(gw.status);
    if (!status) return { outcome: 'ignored' };

    const amountCents = reaisToCents(gw.transactionAmount);

    const result = await this.prisma.$transaction(async (tx): Promise<ProcessResult & { orderNumber?: number }> => {
      // Mesmo webhook repetido: transação já registrada → no-op (um pedido, um alerta).
      const byTransaction = await tx.payment.findUnique({
        where: { gatewayTransactionId: gw.id },
      });
      if (byTransaction) {
        return { outcome: 'already_processed', orderId: byTransaction.orderId };
      }

      const order = gw.externalReference
        ? await tx.order.findUnique({ where: { id: gw.externalReference } })
        : null;
      if (!order) {
        this.logger.error(`payment.orphan_webhook transaction=${gw.id} ref=${gw.externalReference}`);
        return { outcome: 'ignored' };
      }

      // Conferência de valor ANTES de confirmar (seção 5.3): divergência não
      // confirma o pedido e registra incidente.
      if (status === 'paid' && amountCents !== order.totalCents) {
        this.logger.error(
          `payment.amount_mismatch order=${order.id} expected=${order.totalCents} received=${amountCents} transaction=${gw.id}`,
        );
        return { outcome: 'amount_mismatch', orderId: order.id };
      }

      // Um pagamento por pedido (seção 11): nova tentativa após recusa ATUALIZA
      // o registro; pagamento já pago nunca regride para recusado.
      const current = await tx.payment.findUnique({ where: { orderId: order.id } });
      if (current?.status === 'paid' && status !== 'refunded') {
        return { outcome: 'already_processed', orderId: order.id };
      }

      await tx.payment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          method: mapMethod(gw),
          status,
          gatewayTransactionId: gw.id,
          amountCents,
        },
        update: {
          method: mapMethod(gw),
          status,
          gatewayTransactionId: gw.id,
          amountCents,
        },
      });

      if (status === 'paid' && order.status === 'pending_payment') {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'awaiting_acceptance' },
        });
        return { outcome: 'became_paid', orderId: order.id, orderNumber: order.number };
      }
      return { outcome: 'recorded', orderId: order.id };
    });

    // Evento publicado FORA da transação (só depois do commit) e somente na
    // transição para pago — é o único acoplamento com a Fase 2 (seção 2.1).
    if (result.outcome === 'became_paid' && result.orderId) {
      const payload: OrderPaidEvent = {
        orderId: result.orderId,
        orderNumber: (result as { orderNumber?: number }).orderNumber ?? 0,
      };
      this.events.emit(ORDER_PAID, payload);
      this.logger.log(`order.paid id=${result.orderId} transaction=${gw.id}`);
    }
    return { outcome: result.outcome, orderId: result.orderId };
  }

  // Reconciliação (seção 9.2): rede de segurança contra webhooks perdidos.
  // Reusa o processamento idempotente do webhook — regularizar um pedido pela
  // reconciliação dispara o mesmo alerta, uma única vez, com atraso.
  // (O agendamento periódico entra quando a lib de scheduler for aprovada;
  // até lá este método é o ponto de entrada.)
  async reconcilePendingOrders(olderThanMinutes = 5, limit = 50) {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    const pending = await this.prisma.order.findMany({
      where: { status: 'pending_payment', createdAt: { lt: cutoff } },
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
