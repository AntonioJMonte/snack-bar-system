import {
  checkoutResponseSchema,
  deliveryRegionSchema,
  menuSchema,
  orderSchema,
  orderTrackingSchema,
  storeScheduleSchema,
  storeStatusSchema,
  type CreateOrderRequest,
} from '@lanchonete/contracts';
import { z } from 'zod';
import { menuRoute, orderRoute, paymentRoute, storeRoute } from '@/routes';
import { apiRequest } from './api';

// Chamadas do SITE DO CLIENTE. As URLs e os métodos vêm do catálogo em
// `src/routes/` (decisão #29); aqui ficam a validação de resposta e o cache.
// Nenhum preço ou total é enviado ao servidor: o payload de pedido carrega
// apenas item, quantidade, adicionais e observação (seção 5.4).

export function fetchMenu() {
  // Cardápio muda quando o gerente mexe; revalidação curta mantém o site fresco
  // sem transformar cada visita numa consulta ao banco.
  return apiRequest(menuRoute.publicMenu.url(), menuSchema, {
    method: menuRoute.publicMenu.method,
    revalidate: 30,
  });
}

export function fetchStoreStatus() {
  // Estado da loja é informativo aqui. Quem BLOQUEIA o pedido é o servidor, na
  // criação (seção 5.5) — por isso nunca é cacheado.
  return apiRequest(storeRoute.status.url(), storeStatusSchema, {
    method: storeRoute.status.method,
    cache: 'no-store',
  });
}

export function fetchDeliveryRegions() {
  return apiRequest(storeRoute.listRegions.url(), z.array(deliveryRegionSchema), {
    method: storeRoute.listRegions.method,
    revalidate: 60,
  });
}

export function fetchStoreSchedules() {
  return apiRequest(storeRoute.listSchedules.url(), z.array(storeScheduleSchema), {
    method: storeRoute.listSchedules.method,
    revalidate: 60,
  });
}

export function createOrder(input: CreateOrderRequest) {
  return apiRequest(orderRoute.create.url(), orderSchema, {
    method: orderRoute.create.method,
    body: input,
  });
}

export function createCheckout(orderId: string) {
  return apiRequest(paymentRoute.checkout.url(orderId), checkoutResponseSchema, {
    method: paymentRoute.checkout.method,
  });
}

export function fetchOrderTracking(orderId: string) {
  return apiRequest(orderRoute.tracking.url(orderId), orderTrackingSchema, {
    method: orderRoute.tracking.method,
    cache: 'no-store',
  });
}
