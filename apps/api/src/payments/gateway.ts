import { Inject, Injectable } from '@nestjs/common';
import { MercadoPagoConfig, Payment as MpPayment, Preference } from 'mercadopago';
import { CHECKOUT_QR_MINUTES } from '../common/order-expiry';
import { ENV, type Env } from '../config/env';

// Visão NOSSA de um pagamento no gateway — o resto do sistema nunca vê tipos do
// SDK do Mercado Pago. transactionAmount está em REAIS (número decimal do
// gateway): a conversão para centavos acontece em amount.ts, único ponto onde
// um float de dinheiro existe (decisão #6).
export interface GatewayPayment {
  id: string;
  status: string; // approved | rejected | cancelled | refunded | charged_back | ...
  externalReference: string | null; // nosso order.id
  transactionAmount: number; // em reais
  paymentMethodId: string | null; // ex.: "pix", "master"
  paymentTypeId: string | null; // ex.: "bank_transfer", "credit_card", "debit_card"
}

// Teto de espera por QUALQUER chamada ao Mercado Pago (decisão #36). O webhook
// consulta o gateway DENTRO da requisição: sem timeout, uma instabilidade lá
// prende conexões aqui, e várias notificações simultâneas travam a API. O padrão
// do SDK é 10s — 8s deixa margem para o nosso 5xx sair antes de o MP desistir.
export const GATEWAY_TIMEOUT_MS = 8_000;

export interface CheckoutPreferenceInput {
  orderId: string;
  orderNumber: number;
  totalCents: number;
  // Âncora da expiração do QR (decisão #37). É o `createdAt` do PEDIDO, não o
  // instante da chamada: a preferência é reaproveitada (decisão #33), e ancorar
  // em "agora" faria o QR nascer com prazo cheio a partir de um pedido que já
  // está velho — a inversão que a #37 existe para eliminar.
  orderCreatedAt: Date;
}

// Encapsula o SDK oficial. Substituído por um fake nos testes (sem credenciais
// reais, o e2e valida todo o fluxo do webhook do nosso lado).
@Injectable()
export class MercadoPagoClient {
  private readonly config: MercadoPagoConfig;
  private readonly webOrigin: string;
  private readonly apiPublicUrl: string;

  constructor(@Inject(ENV) env: Env) {
    this.config = new MercadoPagoConfig({
      accessToken: env.MP_ACCESS_TOKEN,
      options: { timeout: GATEWAY_TIMEOUT_MS },
    });
    this.webOrigin = env.WEB_ORIGIN;
    this.apiPublicUrl = env.API_PUBLIC_URL;
  }

  async getPayment(id: string): Promise<GatewayPayment> {
    const payment = await new MpPayment(this.config).get({ id });
    return {
      id: String(payment.id),
      status: payment.status ?? 'unknown',
      externalReference: payment.external_reference ?? null,
      transactionAmount: payment.transaction_amount ?? 0,
      paymentMethodId: payment.payment_method_id ?? null,
      paymentTypeId: payment.payment_type_id ?? null,
    };
  }

  // Busca por external_reference (nosso order.id) — base da reconciliação (9.2).
  async searchPaymentsByReference(orderId: string): Promise<GatewayPayment[]> {
    const result = await new MpPayment(this.config).search({
      options: { external_reference: orderId },
    });
    return (result.results ?? []).map((payment) => ({
      id: String(payment.id),
      status: payment.status ?? 'unknown',
      externalReference: payment.external_reference ?? null,
      transactionAmount: payment.transaction_amount ?? 0,
      paymentMethodId: payment.payment_method_id ?? null,
      paymentTypeId: payment.payment_type_id ?? null,
    }));
  }

  async createCheckout(input: CheckoutPreferenceInput): Promise<{ initPoint: string }> {
    const preference = await new Preference(this.config).create({
      body: {
        notification_url: `${this.apiPublicUrl}/payments/webhook/mercadopago`,
        external_reference: input.orderId,
        // Prazo do QR Pix DITADO POR NÓS (decisão #37). Sem este campo vale o
        // padrão do gateway (24h), e um QR válido por um dia inteiro contra um
        // pedido que expira em 50 min transforma pagamento fora do prazo em
        // rotina. Mesma constante que governa a expiração do pedido, então os
        // dois lados não podem discordar.
        date_of_expiration: new Date(
          input.orderCreatedAt.getTime() + CHECKOUT_QR_MINUTES * 60 * 1000,
        ).toISOString(),
        items: [
          {
            id: input.orderId,
            title: `Pedido #${input.orderNumber}`,
            quantity: 1,
            unit_price: input.totalCents / 100, // fronteira única com o gateway
            currency_id: 'BRL',
          },
        ],
        // Apenas os métodos do PDF (10.3): Pix, crédito e débito.
        payment_methods: {
          excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }],
        },
        // Volta ao acompanhamento do pedido no site. Navegação apenas: a prova
        // de pagamento é SEMPRE o webhook assinado (seção 5.3).
        back_urls: {
          success: `${this.webOrigin}/pedido/${input.orderId}`,
          pending: `${this.webOrigin}/pedido/${input.orderId}`,
          failure: `${this.webOrigin}/pedido/${input.orderId}`,
        },
      },
    });
    return { initPoint: preference.init_point ?? '' };
  }
}
