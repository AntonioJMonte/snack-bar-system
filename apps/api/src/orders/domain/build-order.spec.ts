import { describe, expect, it } from 'vitest';
import { DomainError } from '../../common/domain-error';
import type { CreateOrderInput } from '../dto/create-order.schema';
import {
  buildOrder,
  type BuildOrderContext,
  type CatalogItem,
  type RegionData,
} from './build-order';

const ITEM_ID = '01890a5d-ac96-774b-bcce-b302099a8057';
const ADDON_ID = '01890a5d-ac96-774b-bcce-b302099a8058';
const REGION_ID = '01890a5d-ac96-774b-bcce-b302099a8059';

function catalogItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: ITEM_ID,
    name: 'X-Burger',
    priceCents: 1000,
    discountPercent: 0,
    soldOut: false,
    active: true,
    addons: [{ id: ADDON_ID, name: 'Bacon', priceCents: 200, active: true }],
    ...overrides,
  };
}

function pickupInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    channel: 'web',
    customerName: 'Maria',
    customerPhone: '11987654321',
    deliveryType: 'pickup',
    address: undefined,
    regionId: undefined,
    items: [{ itemId: ITEM_ID, quantity: 1, addonIds: [] }],
    ...overrides,
  } as CreateOrderInput;
}

function ctx(overrides: Partial<BuildOrderContext> = {}): BuildOrderContext {
  return {
    catalog: new Map([[ITEM_ID, catalogItem()]]),
    region: null,
    store: { open: true, source: 'scheduled' },
    ...overrides,
  };
}

function expectDomainError(fn: () => unknown, code: string) {
  try {
    fn();
    expect.fail(`esperava DomainError ${code}`);
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe(code);
  }
}

describe('buildOrder — bloqueios', () => {
  it('loja fechada por horário: STORE_CLOSED com origem scheduled', () => {
    try {
      buildOrder(pickupInput(), ctx({ store: { open: false, source: 'scheduled' } }));
      expect.fail();
    } catch (e) {
      expect((e as DomainError).code).toBe('STORE_CLOSED');
      expect((e as DomainError).details).toEqual({ source: 'scheduled' });
    }
  });

  it('loja fechada manualmente dentro do horário: STORE_CLOSED com origem manual', () => {
    try {
      buildOrder(pickupInput(), ctx({ store: { open: false, source: 'manual' } }));
      expect.fail();
    } catch (e) {
      expect((e as DomainError).code).toBe('STORE_CLOSED');
      expect((e as DomainError).details).toEqual({ source: 'manual' });
    }
  });

  it('loja aberta manualmente fora do horário: pedido aceito', () => {
    const built = buildOrder(pickupInput(), ctx({ store: { open: true, source: 'manual' } }));
    expect(built.totalCents).toBe(1000);
  });

  it('item inexistente: ITEM_NOT_FOUND', () => {
    expectDomainError(
      () => buildOrder(pickupInput(), ctx({ catalog: new Map() })),
      'ITEM_NOT_FOUND',
    );
  });

  it('item inativo: ITEM_INACTIVE', () => {
    const c = ctx({ catalog: new Map([[ITEM_ID, catalogItem({ active: false })]]) });
    expectDomainError(() => buildOrder(pickupInput(), c), 'ITEM_INACTIVE');
  });

  it('item esgotado: ITEM_SOLD_OUT identificando o item', () => {
    const c = ctx({ catalog: new Map([[ITEM_ID, catalogItem({ soldOut: true })]]) });
    try {
      buildOrder(pickupInput(), c);
      expect.fail();
    } catch (e) {
      expect((e as DomainError).code).toBe('ITEM_SOLD_OUT');
      expect((e as DomainError).details).toMatchObject({ itemName: 'X-Burger' });
    }
  });

  it('adicional que não pertence ao item: ADDON_NOT_FOR_ITEM', () => {
    const input = pickupInput({
      items: [{ itemId: ITEM_ID, quantity: 1, addonIds: [REGION_ID] }],
    });
    expectDomainError(() => buildOrder(input, ctx()), 'ADDON_NOT_FOR_ITEM');
  });

  it('entrega com região inexistente/inativa: erros específicos', () => {
    const input = pickupInput({ deliveryType: 'delivery', address: 'Rua X, 1', regionId: REGION_ID });
    expectDomainError(() => buildOrder(input, ctx({ region: null })), 'REGION_NOT_FOUND');
    const inactive: RegionData = { id: REGION_ID, name: 'Centro', feeCents: 500, active: false };
    expectDomainError(() => buildOrder(input, ctx({ region: inactive })), 'REGION_INACTIVE');
  });
});

describe('buildOrder — cálculo e congelamento (seção 5.4)', () => {
  it.each([
    [0, 1200, 0, 1200],
    [15, 1200, 180, 1020],
    [100, 1200, 1200, 0],
  ])('desconto de %s%%: cheio %s, desconto %s, líquido %s', (percent, full, discount, net) => {
    const c = ctx({ catalog: new Map([[ITEM_ID, catalogItem({ discountPercent: percent })]]) });
    const input = pickupInput({ items: [{ itemId: ITEM_ID, quantity: 1, addonIds: [ADDON_ID] }] });
    const built = buildOrder(input, c);
    expect(built.items[0].unitFullPriceCents).toBe(full);
    expect(built.items[0].unitDiscountCents).toBe(discount);
    expect(built.items[0].unitNetPriceCents).toBe(net);
  });

  it('arredondamento half-up por unidade: 33% sobre 999', () => {
    const c = ctx({
      catalog: new Map([[ITEM_ID, catalogItem({ priceCents: 999, discountPercent: 33, addons: [] })]]),
    });
    const built = buildOrder(pickupInput({ items: [{ itemId: ITEM_ID, quantity: 3, addonIds: [] }] }), c);
    expect(built.items[0].unitDiscountCents).toBe(330); // 329,67 → 330
    expect(built.items[0].unitNetPriceCents).toBe(669);
    // Linha = unitário × quantidade, sem resíduo:
    expect(built.subtotalNetCents).toBe(669 * 3);
  });

  it('nome do item é congelado no momento da compra', () => {
    const built = buildOrder(pickupInput(), ctx());
    expect(built.items[0].itemName).toBe('X-Burger');
  });

  it('preço alterado depois não afeta pedido já construído (congelamento)', () => {
    const first = buildOrder(pickupInput(), ctx());
    const changed = ctx({ catalog: new Map([[ITEM_ID, catalogItem({ priceCents: 1500, name: 'X-Burger Novo' })]]) });
    const second = buildOrder(pickupInput(), changed);
    expect(first.items[0].unitFullPriceCents).toBe(1000);
    expect(first.items[0].itemName).toBe('X-Burger');
    expect(second.items[0].unitFullPriceCents).toBe(1500);
  });

  it('adicionais congelam nome e preço', () => {
    const input = pickupInput({ items: [{ itemId: ITEM_ID, quantity: 1, addonIds: [ADDON_ID] }] });
    const built = buildOrder(input, ctx());
    expect(built.items[0].addons).toEqual([{ addonId: ADDON_ID, name: 'Bacon', priceCents: 200 }]);
  });

  it('taxa de entrega aplicada só na entrega e sem desconto', () => {
    const region: RegionData = { id: REGION_ID, name: 'Centro', feeCents: 700, active: true };
    const c = ctx({
      region,
      catalog: new Map([[ITEM_ID, catalogItem({ discountPercent: 50, addons: [] })]]),
    });
    const input = pickupInput({ deliveryType: 'delivery', address: 'Rua X, 1', regionId: REGION_ID });
    const built = buildOrder(input, c);
    expect(built.deliveryFeeCents).toBe(700); // taxa intacta, apesar do desconto de 50%
    expect(built.subtotalNetCents).toBe(500);
    expect(built.totalCents).toBe(1200);

    const pickup = buildOrder(pickupInput(), ctx());
    expect(pickup.deliveryFeeCents).toBe(0);
  });

  it('aritmética fecha: cheio − descontos = líquido; líquido + taxa = total', () => {
    const region: RegionData = { id: REGION_ID, name: 'Centro', feeCents: 350, active: true };
    const c = ctx({
      region,
      catalog: new Map([[ITEM_ID, catalogItem({ priceCents: 999, discountPercent: 33 })]]),
    });
    const input = pickupInput({
      deliveryType: 'delivery',
      address: 'Rua X, 1',
      regionId: REGION_ID,
      items: [{ itemId: ITEM_ID, quantity: 7, addonIds: [ADDON_ID] }],
    });
    const built = buildOrder(input, c);
    expect(built.subtotalFullCents - built.discountTotalCents).toBe(built.subtotalNetCents);
    expect(built.subtotalNetCents + built.deliveryFeeCents).toBe(built.totalCents);
  });
});
