import type { OrderStatus } from '@lanchonete/contracts';
import { route } from './types';

export interface OrderHistoryQuery {
  status?: OrderStatus;
  limit?: number;
}

// Pedidos — apps/api/src/orders/orders.controller.ts
export const orderRoute = {
  /** Criação: pública (o cliente não tem login). O servidor recalcula tudo. */
  create: route('POST', () => '/orders', null),

  /**
   * Acompanhamento do cliente: público, acessível só por quem tem o UUID
   * (não enumerável, decisão #9). Não expõe dado operacional da loja.
   */
  tracking: route('GET', (orderId: string) => `/orders/${orderId}/tracking`, null),

  /**
   * Histórico do painel administrativo: inclui pedidos concluídos, que o painel
   * de produção já não lista.
   */
  history: route(
    'GET',
    (query: OrderHistoryQuery = {}) => {
      const params = new URLSearchParams();
      if (query.status) params.set('status', query.status);
      if (query.limit !== undefined) params.set('limit', String(query.limit));
      const search = params.toString();
      return search ? `/orders?${search}` : '/orders';
    },
    'manager',
  ),
} as const;
