import { Inject, Injectable } from '@nestjs/common';
import { MercadoPagoConfig, Payment as MpPayment, Preference } from 'mercadopago';
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
}

// Encapsula o SDK oficial. Substituído por um fake nos testes (sem credenciais
// reais, o e2e valida todo o fluxo do webhook do nosso lado).
@Injectable()
export class MercadoPagoClient {
  private readonly config: MercadoPagoConfig;
  private readonly webOrigin: string;

  constructor(@Inject(ENV) env: Env) {
    this.config = new MercadoPagoConfig({
      accessToken: env.MP_ACCESS_TOKEN,
      options: { timeout: GATEWAY_TIMEOUT_MS },
    });
    this.webOrigin = env.WEB_ORIGIN;
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
        external_reference: input.orderId,
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
