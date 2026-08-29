import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DomainError } from '../common/domain-error';
import { ENV, type Env } from '../config/env';
import { MercadoPagoClient } from './gateway';
import { PaymentsService } from './payments.service';
import { validateMercadoPagoSignature } from './webhook-signature';

interface WebhookBody {
  type?: string;
  data?: { id?: string | number };
}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly gateway: MercadoPagoClient,
    @Inject(ENV) private readonly env: Env,
  ) {}

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
      throw new UnauthorizedException({ code: 'INVALID_WEBHOOK_SIGNATURE' });
    }

    const payment = await this.gateway.getPayment(dataId);
    const result = await this.paymentsService.processPaymentNotification(payment);
    return { received: true, outcome: result.outcome };
  }
}
