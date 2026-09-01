import { route } from './types';

// Cardápio — apps/api/src/menu/menu-public.controller.ts e menu.controller.ts
export const menuRoute = {
  /** Cardápio do cliente: só categorias e itens ATIVOS, esgotado sinalizado. */
  publicMenu: route('GET', () => '/menu', null),

  /** Catálogo de gestão: inclui inativos, para poder reativá-los. */
  catalog: route('GET', () => '/menu/catalog', 'manager'),

  createCategory: route('POST', () => '/menu/categories', 'manager'),
  updateCategory: route('PATCH', (categoryId: string) => `/menu/categories/${categoryId}`, 'manager'),

  createItem: route('POST', () => '/menu/items', 'manager'),
  updateItem: route('PATCH', (itemId: string) => `/menu/items/${itemId}`, 'manager'),

  /** Alterar preço e desconto é operação financeira: gerente+ e auditada. */
  updatePrice: route('PATCH', (itemId: string) => `/menu/items/${itemId}/price`, 'manager'),
  updateDiscount: route('PATCH', (itemId: string) => `/menu/items/${itemId}/discount`, 'manager'),

  /** Marcar esgotado é operação do dia a dia: atendente+ (seção 5.5). */
  setSoldOut: route('PATCH', (itemId: string) => `/menu/items/${itemId}/sold-out`, 'attendant'),

  createAddon: route('POST', (itemId: string) => `/menu/items/${itemId}/addons`, 'manager'),
  updateAddon: route('PATCH', (addonId: string) => `/menu/addons/${addonId}`, 'manager'),
} as const;
