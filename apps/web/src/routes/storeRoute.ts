import { route } from './types';

// Loja: estado, horários e regiões — apps/api/src/store/store.controller.ts
export const storeRoute = {
  /**
   * Informativo para o site. Quem IMPEDE o pedido é a criação do pedido no
   * servidor (seção 5.5) — validar só aqui deixaria passar pedido após fechar.
   */
  status: route('GET', () => '/store/status', null),

  /** Abertura ou fechamento manual: sobrepõe o horário e expira ao fim do dia. */
  override: route('POST', () => '/store/override', 'manager'),

  listSchedules: route('GET', () => '/store/schedules', null),
  /** Substitui a semana INTEIRA: o estado final é exatamente o enviado. */
  replaceSchedules: route('PUT', () => '/store/schedules', 'manager'),

  listRegions: route('GET', () => '/store/regions', null),
  createRegion: route('POST', () => '/store/regions', 'manager'),
  updateRegion: route('PATCH', (regionId: string) => `/store/regions/${regionId}`, 'manager'),
} as const;
