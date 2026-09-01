import { route } from './types';

// Painel de produção — apps/api/src/panel/panel.controller.ts
// Módulo de SAÍDA: fala só com o backend, nunca com um canal de entrada (seção 13).
export const panelRoute = {
  /** Pedidos ativos em ordem de chegada. Consultado por polling de 5–10s. */
  listOrders: route('GET', () => '/panel/orders', 'attendant'),

  /** Aceite explícito: registra QUEM viu e QUANDO, e encerra o alerta (seção 8.3). */
  accept: route('POST', (orderId: string) => `/panel/orders/${orderId}/accept`, 'attendant'),

  /** Avanço de status: um passo por vez, validado pelo tipo de entrega. */
  advanceStatus: route('POST', (orderId: string) => `/panel/orders/${orderId}/status`, 'attendant'),

  /** Sinal de vida a cada 30s, com o estado do som (seção 8.2). */
  heartbeat: route('POST', () => '/panel/heartbeat', 'attendant'),

  /** Painéis ativos: quais dispositivos estão vivos e desde quando (seção 5.7). */
  listSessions: route('GET', () => '/panel/sessions', 'manager'),
} as const;
