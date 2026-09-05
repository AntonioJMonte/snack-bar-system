import {
  Body,
  Controller,
  Logger,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DomainError } from '../common/domain-error';
import { ENV, type Env } from '../config/env';
import { MercadoPagoClient } from './gateway';
import { PaymentsService } from './payments.service';
import { validateMercadoPagoSignature } from './webhook-signature';

interface WebhookBody {
  type?: string;
  data?: { id?: string | number };
}

// Só o `ts` do cabeçalho `x-signature`, para o log do 401. O `v1` é material
// derivado do segredo do webhook e NUNCA entra em log — nem inteiro, nem em
// pedaço. O `ts`, sozinho, não permite forjar nada.
function signatureTimestamp(xSignature: string | undefined): string | undefined {
  const ts = xSignature
    ?.split(',')
    .map((part) => part.split('='))
    .find(([key]) => key?.trim() === 'ts')?.[1]
    ?.trim();
  return ts && ts.length > 0 ? ts : undefined;
}

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly gateway: MercadoPagoClient,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // Mesma exposição do POST /orders e mesmo limite (decisão #35).
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('checkout/:orderId')
  async checkout(@Param('orderId', ParseUUIDPipe) orderId: string) {
    try {
      return await this.paymentsService.createCheckout(orderId);
    } catch (error) {
      if (error instanceof DomainError && error.code === 'ORDER_NOT_FOUND') {
        throw new NotFoundException({ code: error.code, details: error.details });
      }
      if (error instanceof DomainError) {
        throw new UnprocessableEntityException({
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        });
      }
      throw error;
    }
  }

  // O retorno do navegador NUNCA é prova de pagamento (seção 5.3): só este
  // webhook assinado confirma. O conteúdo do corpo é entrada não confiável —
  // o pagamento é sempre re-consultado no gateway.
  // 600/min (decisão #35). O cenário que manda no número não é o volume normal
  // do Mercado Pago — é quando ele volta de uma instabilidade e despeja o
  // acúmulo de notificações de uma vez. É exatamente aí que barrar significa
  // pagamento não confirmado. Antes disto o webhook dividia o balde comum de
  // 20/min e requisição com assinatura INVÁLIDA já consumia cota.
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Post('webhook/mercadopago')
  @HttpCode(200)
  async webhook(
    @Query() query: Record<string, string>,
    @Headers('x-signature') xSignature: string | undefined,
    @Headers('x-request-id') xRequestId: string | undefined,
    @Body() body: WebhookBody,
  ) {
    const type = query.type ?? body?.type;
    const dataId = query['data.id'] ?? (body?.data?.id != null ? String(body.data.id) : undefined);

    // Eventos que não são de pagamento: reconhece e ignora.
    if (type !== 'payment' || !dataId) return { received: true };

    const valid = validateMercadoPagoSignature({
      xSignature,
      xRequestId,
      dataId,
      secret: this.env.MP_WEBHOOK_SECRET,
    });
    if (!valid) {
      // Sem assinatura válida, qualquer um poderia declarar um pedido como pago (12.1).
      //
      // O 401 mudo era a última falha silenciosa do caminho do dinheiro: segredo
      // trocado no painel do Mercado Pago, relógio do container fora de sincronia
      // (a janela de frescor da decisão #36 tem 5 min) e tentativa de fraude
      // produzem EXATAMENTE o mesmo 401, e nada ficava registrado. Do lado do
      // gateway o sintoma é só "notificação falhou": o pagamento existe lá e o
      // pedido nunca confirma aqui.
      //
      // Os três campos são o mínimo para separar os casos: `transaction` cruza
      // com o pagamento no painel do MP, `request-id` é a chave da notificação
      // no log deles, e `ts` mostra na hora se o problema é relógio (ts muito
      // distante do agora) ou segredo (ts recente e assinatura mesmo assim
      // inválida). Segredo e assinatura NÃO entram aqui.
      this.logger.warn(
        `payment.invalid_webhook_signature transaction=${dataId} ` +
          `request-id=${xRequestId ?? '(ausente)'} ts=${signatureTimestamp(xSignature) ?? '(ausente)'}`,
      );
      throw new UnauthorizedException({ code: 'INVALID_WEBHOOK_SIGNATURE' });
    }

    // Consulta ao gateway com timeout de 8s (decisão #36). Falha aqui — timeout,
    // instabilidade, 500 do lado deles — não pode virar 2xx: o Mercado Pago
    // consideraria entregue e a notificação se perderia.
    let payment;
    try {
      payment = await this.gateway.getPayment(dataId);
    } catch (error) {
      this.logger.error(`payment.gateway_unreachable transaction=${dataId}: ${String(error)}`);
      throw new ServiceUnavailableException({ code: 'GATEWAY_UNREACHABLE' });
    }

    const result = await this.paymentsService.processPaymentNotification(payment);

    // Não conseguimos serializar a tempo: nada foi persistido. Responder 2xx aqui
    // faria o Mercado Pago considerar a notificação entregue e nunca reenviá-la —
    // o pagamento existiria no gateway e não no nosso banco. 5xx é o único
    // retorno que preserva o reenvio (critério 4).
    if (result.outcome === 'lock_timeout') {
      throw new ServiceUnavailableException({ code: 'PAYMENT_LOCK_TIMEOUT' });
    }

    return { received: true, outcome: result.outcome };
  }
}
