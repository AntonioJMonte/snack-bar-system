import { route } from './types';

// Pagamento — apps/api/src/payments/payments.controller.ts
//
// Existe também `POST /payments/webhook/mercadopago` na API. Ela NÃO está neste
// catálogo de propósito: é chamada pelo gateway, servidor a servidor, e protegida
// por assinatura. O navegador nunca a chama — o retorno do navegador jamais é
// prova de pagamento (seção 5.3).
export const paymentRoute = {
  /** Cria a preferência e devolve a URL do ambiente do gateway. */
  checkout: route('POST', (orderId: string) => `/payments/checkout/${orderId}`, null),
} as const;
