// Único ponto de acoplamento entre Fase 1 e Fase 2 (seção 2.1).
// No PDF o evento chama-se `pedido.pago`; em código, `order.paid` (decisão #4).
export const ORDER_PAID = 'order.paid';

export interface OrderPaidEvent {
  orderId: string;
  orderNumber: number;
}
