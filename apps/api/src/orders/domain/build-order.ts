import { DomainError } from '../../common/domain-error';
import type { CreateOrderInput } from '../dto/create-order.schema';
import { priceUnit } from './pricing';

// Núcleo PURO da criação de pedido: recebe dados já buscados, valida e calcula.
// O servidor recalcula TUDO a partir do cardápio (seção 5.4); nenhum valor do
// cliente chega até aqui (o schema já removeu campos desconhecidos).

export interface CatalogAddon {
  id: string;
  name: string;
  priceCents: number;
  active: boolean;
}

export interface CatalogItem {
  id: string;
  name: string;
  priceCents: number;
  discountPercent: number;
  soldOut: boolean;
  active: boolean;
  addons: CatalogAddon[];
}

export interface RegionData {
  id: string;
  name: string;
  feeCents: number;
  active: boolean;
}

export interface StoreOpenStatus {
  open: boolean;
  source: 'manual' | 'scheduled';
}

export interface BuildOrderContext {
  catalog: ReadonlyMap<string, CatalogItem>;
  region: RegionData | null;
  store: StoreOpenStatus;
}

export interface BuiltOrderItem {
  itemId: string;
  itemName: string; // congelado no momento da compra
  quantity: number;
  unitFullPriceCents: number;
  discountPercentApplied: number;
  unitDiscountCents: number;
  unitNetPriceCents: number;
  note: string | null;
  addons: { addonId: string; name: string; priceCents: number }[]; // congelados
}

export interface BuiltOrder {
  channel: 'web' | 'whatsapp';
  customerName: string;
  customerPhone: string;
  deliveryType: 'pickup' | 'delivery';
  address: string | null;
  regionId: string | null;
  subtotalFullCents: number;
  discountTotalCents: number;
  subtotalNetCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  items: BuiltOrderItem[];
}

export function buildOrder(input: CreateOrderInput, ctx: BuildOrderContext): BuiltOrder {
  // Loja fechada: validada na CRIAÇÃO do pedido no servidor (seção 5.5), com a
  // origem do fechamento identificada no erro.
  if (!ctx.store.open) {
    throw new DomainError(
      'STORE_CLOSED',
      ctx.store.source === 'manual'
        ? 'A loja está fechada no momento.'
        : 'A loja está fora do horário de funcionamento.',
      { source: ctx.store.source },
    );
  }

  const items = input.items.map((line): BuiltOrderItem => {
    const item = ctx.catalog.get(line.itemId);
    if (!item) {
      throw new DomainError('ITEM_NOT_FOUND', 'Item não existe no cardápio.', { itemId: line.itemId });
    }
    if (!item.active) {
      throw new DomainError('ITEM_INACTIVE', `Item indisponível: ${item.name}.`, { itemId: item.id, itemName: item.name });
    }
    if (item.soldOut) {
      // Checkout bloqueado apontando QUAL item esgotou (fluxo de exceção 6.3).
      throw new DomainError('ITEM_SOLD_OUT', `Item esgotado: ${item.name}.`, { itemId: item.id, itemName: item.name });
    }

    const addons = line.addonIds.map((addonId) => {
      const addon = item.addons.find((a) => a.id === addonId);
      if (!addon) {
        throw new DomainError('ADDON_NOT_FOR_ITEM', `Adicional não pertence ao item ${item.name}.`, { addonId, itemId: item.id });
      }
      if (!addon.active) {
        throw new DomainError('ADDON_INACTIVE', `Adicional indisponível: ${addon.name}.`, { addonId: addon.id });
      }
      return addon;
    });

    const priced = priceUnit(item.priceCents, addons.map((a) => a.priceCents), item.discountPercent);

    return {
      itemId: item.id,
      itemName: item.name,
      quantity: line.quantity,
      unitFullPriceCents: priced.unitFullCents,
      discountPercentApplied: priced.discountPercentApplied,
      unitDiscountCents: priced.unitDiscountCents,
      unitNetPriceCents: priced.unitNetCents,
      note: line.note ?? null,
      addons: addons.map((a) => ({ addonId: a.id, name: a.name, priceCents: a.priceCents })),
    };
  });

  const subtotalFullCents = items.reduce((s, i) => s + i.unitFullPriceCents * i.quantity, 0);
  const discountTotalCents = items.reduce((s, i) => s + i.unitDiscountCents * i.quantity, 0);
  const subtotalNetCents = subtotalFullCents - discountTotalCents;

  // Taxa de entrega só na entrega, pela região, e NUNCA recebe desconto (seção 5.4).
  let deliveryFeeCents = 0;
  let regionId: string | null = null;
  if (input.deliveryType === 'delivery') {
    if (!ctx.region) {
      throw new DomainError('REGION_NOT_FOUND', 'Região de entrega não existe.', { regionId: input.regionId });
    }
    if (!ctx.region.active) {
      throw new DomainError('REGION_INACTIVE', `Região sem entrega no momento: ${ctx.region.name}.`, { regionId: ctx.region.id });
    }
    deliveryFeeCents = ctx.region.feeCents;
    regionId = ctx.region.id;
  }

  return {
    channel: input.channel,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    deliveryType: input.deliveryType,
    address: input.deliveryType === 'delivery' ? (input.address ?? null) : null,
    regionId,
    subtotalFullCents,
    discountTotalCents,
    subtotalNetCents,
    deliveryFeeCents,
    totalCents: subtotalNetCents + deliveryFeeCents,
    items,
  };
}
