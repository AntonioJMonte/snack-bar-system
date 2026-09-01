import { describe, expect, it } from 'vitest';
import { auditRoute } from './auditRoute';
import { authRoute } from './authRoute';
import { menuRoute } from './menuRoute';
import { orderRoute } from './orderRoute';
import { panelRoute } from './panelRoute';
import { paymentRoute } from './paymentRoute';
import { storeRoute } from './storeRoute';
import { userRoute } from './userRoute';
import type { Route } from './types';

// O catálogo é só declaração, então um erro aqui é sempre de digitação: uma barra
// a menos, um método trocado, uma rota duplicada por copiar e colar. Estes testes
// existem para pegar exatamente isso.

const CATALOGS = {
  authRoute,
  menuRoute,
  storeRoute,
  orderRoute,
  paymentRoute,
  panelRoute,
  userRoute,
  auditRoute,
} as const;

// Chama cada `url()` com argumentos de exemplo para conseguir inspecionar o
// caminho gerado, sem precisar saber a assinatura de cada uma.
function sampleUrl(entry: Route<never[]>): string {
  const build = entry.url as (...args: unknown[]) => string;
  return build('exemplo-id');
}

const allEntries = Object.entries(CATALOGS).flatMap(([catalogName, catalog]) =>
  Object.entries(catalog).map(([routeName, entry]) => ({
    name: `${catalogName}.${routeName}`,
    entry: entry as Route<never[]>,
  })),
);

describe('catálogo de rotas', () => {
  it('cobre os oito casos de uso da API', () => {
    expect(Object.keys(CATALOGS)).toHaveLength(8);
  });

  it('toda URL começa com barra e não tem barra dupla', () => {
    for (const { name, entry } of allEntries) {
      const url = sampleUrl(entry);
      expect(url.startsWith('/'), `${name} não começa com "/": ${url}`).toBe(true);
      expect(url.includes('//'), `${name} tem barra dupla: ${url}`).toBe(false);
    }
  });

  it('nenhuma rota fica com parâmetro por interpolar', () => {
    for (const { name, entry } of allEntries) {
      const url = sampleUrl(entry);
      expect(url.includes('undefined'), `${name} ficou com undefined: ${url}`).toBe(false);
      expect(url.includes('[object'), `${name} interpolou um objeto: ${url}`).toBe(false);
    }
  });

  it('não há duas rotas com o mesmo método e caminho', () => {
    const seen = new Map<string, string>();
    for (const { name, entry } of allEntries) {
      const key = `${entry.method} ${sampleUrl(entry)}`;
      const previous = seen.get(key);
      expect(previous, `${name} duplica ${previous} (${key})`).toBeUndefined();
      seen.set(key, name);
    }
  });
});

describe('caminhos parametrizados', () => {
  it('interpola o id do item nas rotas de cardápio', () => {
    expect(menuRoute.updatePrice.url('abc')).toBe('/menu/items/abc/price');
    expect(menuRoute.updateDiscount.url('abc')).toBe('/menu/items/abc/discount');
    expect(menuRoute.setSoldOut.url('abc')).toBe('/menu/items/abc/sold-out');
    expect(menuRoute.createAddon.url('abc')).toBe('/menu/items/abc/addons');
  });

  it('interpola o id do pedido nas rotas de painel e acompanhamento', () => {
    expect(panelRoute.accept.url('p1')).toBe('/panel/orders/p1/accept');
    expect(panelRoute.advanceStatus.url('p1')).toBe('/panel/orders/p1/status');
    expect(orderRoute.tracking.url('p1')).toBe('/orders/p1/tracking');
    expect(paymentRoute.checkout.url('p1')).toBe('/payments/checkout/p1');
  });
});

describe('rotas com query', () => {
  it('omite a query quando não há filtro', () => {
    expect(orderRoute.history.url()).toBe('/orders');
    expect(auditRoute.list.url()).toBe('/audit');
  });

  it('monta a query só com o que foi informado', () => {
    expect(orderRoute.history.url({ limit: 100 })).toBe('/orders?limit=100');
    expect(orderRoute.history.url({ status: 'completed' })).toBe('/orders?status=completed');
    expect(orderRoute.history.url({ status: 'ready', limit: 20 })).toBe(
      '/orders?status=ready&limit=20',
    );
    expect(auditRoute.list.url({ entity: 'Item', limit: 5 })).toBe('/audit?entity=Item&limit=5');
  });

  it('aceita limite zero sem confundir com ausente', () => {
    // `if (query.limit)` trataria 0 como não informado; a checagem é !== undefined.
    expect(orderRoute.history.url({ limit: 0 })).toBe('/orders?limit=0');
  });
});

describe('perfil mínimo documentado', () => {
  it('marca como públicas apenas as rotas que o cliente sem login usa', () => {
    const publicRoutes = allEntries
      .filter(({ entry }) => entry.minRole === null)
      .map(({ name }) => name)
      .sort();

    expect(publicRoutes).toEqual([
      'authRoute.login',
      'menuRoute.publicMenu',
      'orderRoute.create',
      'orderRoute.tracking',
      'paymentRoute.checkout',
      'storeRoute.listRegions',
      'storeRoute.listSchedules',
      'storeRoute.status',
    ]);
  });

  it('mantém esgotado como atendente e preço como gerente (seção 5.5)', () => {
    // A separação que existe porque alterar preço mexe em dinheiro e marcar
    // esgotado é operação do dia a dia.
    expect(menuRoute.setSoldOut.minRole).toBe('attendant');
    expect(menuRoute.updatePrice.minRole).toBe('manager');
    expect(menuRoute.updateDiscount.minRole).toBe('manager');
  });

  it('mantém usuários e auditoria restritos ao administrador', () => {
    expect(userRoute.create.minRole).toBe('admin');
    expect(auditRoute.list.minRole).toBe('admin');
  });
});
