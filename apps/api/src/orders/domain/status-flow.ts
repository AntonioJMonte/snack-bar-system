import type { DeliveryType, OrderStatus } from '@prisma/client';

// Transições de produção (decisão #19): um passo por vez, dependentes do tipo
// de entrega — retirada pula `out_for_delivery` (não existe "a caminho" no
// balcão). O aceite (awaiting_acceptance → accepted) é EXCLUSIVO do endpoint de
// aceite, que registra quem/quando e encerra o alerta.

export function allowedNextStatus(
  deliveryType: DeliveryType,
  from: OrderStatus,
): OrderStatus | null {
  switch (from) {
    case 'accepted':
      return 'preparing';
    case 'preparing':
      return 'ready';
    case 'ready':
      return deliveryType === 'delivery' ? 'out_for_delivery' : 'completed';
    case 'out_for_delivery':
      return deliveryType === 'delivery' ? 'completed' : null;
    default:
      return null; // pending_payment/awaiting_acceptance/completed não avançam por aqui
  }
}

export function canTransition(
  deliveryType: DeliveryType,
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return allowedNextStatus(deliveryType, from) === to;
}
