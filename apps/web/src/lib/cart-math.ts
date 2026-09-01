import { priceUnit, type MenuItem } from '@lanchonete/contracts';

// Cálculo de EXIBIÇÃO do carrinho. Puro e sem dependência de estado, para ser
// testável isoladamente. Usa priceUnit — a MESMA função do servidor (decisão
// #24) — para que o número na tela seja o número que será gravado. Ainda assim
// é apenas prévia: o total que vale é o recalculado pelo servidor (seção 5.4).

export interface CartAddon {
  id: string;
  name: string;
  priceCents: number;
}

export interface CartLine {
  // Identifica a linha localmente: o mesmo item com adicionais ou observação
  // diferentes ocupa linhas separadas.
  lineId: string;
  itemId: string;
  itemName: string;
  basePriceCents: number;
  discountPercent: number;
  addons: CartAddon[];
  quantity: number;
  note?: string;
}

export interface LineTotals {
  unitFullCents: number;
  unitDiscountCents: number;
  unitNetCents: number;
  lineFullCents: number;
  lineDiscountCents: number;
  lineNetCents: number;
}

export function lineTotals(line: CartLine): LineTotals {
  const unit = priceUnit(
    line.basePriceCents,
    line.addons.map((a) => a.priceCents),
    line.discountPercent,
  );
  // O desconto é arredondado POR UNIDADE e só então multiplicado pela
  // quantidade (decisão #7) — nunca o contrário.
  return {
    unitFullCents: unit.unitFullCents,
    unitDiscountCents: unit.unitDiscountCents,
    unitNetCents: unit.unitNetCents,
    lineFullCents: unit.unitFullCents * line.quantity,
    lineDiscountCents: unit.unitDiscountCents * line.quantity,
    lineNetCents: unit.unitNetCents * line.quantity,
  };
}

export interface CartTotals {
  subtotalFullCents: number;
  discountTotalCents: number;
  subtotalNetCents: number;
  itemCount: number;
}

export function cartTotals(lines: CartLine[]): CartTotals {
  return lines.reduce<CartTotals>(
    (acc, line) => {
      const totals = lineTotals(line);
      return {
        subtotalFullCents: acc.subtotalFullCents + totals.lineFullCents,
        discountTotalCents: acc.discountTotalCents + totals.lineDiscountCents,
        subtotalNetCents: acc.subtotalNetCents + totals.lineNetCents,
        itemCount: acc.itemCount + line.quantity,
      };
    },
    { subtotalFullCents: 0, discountTotalCents: 0, subtotalNetCents: 0, itemCount: 0 },
  );
}

// Assinatura do que torna duas linhas "a mesma": item + adicionais + observação.
export function lineSignature(line: Omit<CartLine, 'lineId' | 'quantity'>): string {
  const addons = [...line.addons.map((a) => a.id)].sort().join(',');
  return `${line.itemId}|${addons}|${line.note ?? ''}`;
}

// Converte uma linha do cardápio no formato do carrinho, congelando o snapshot
// de exibição no momento em que o cliente adicionou.
export function cartLineFromMenuItem(
  item: MenuItem,
  addons: CartAddon[],
  quantity: number,
  note?: string,
): Omit<CartLine, 'lineId'> {
  return {
    itemId: item.id,
    itemName: item.name,
    basePriceCents: item.priceCents,
    discountPercent: item.discountPercent,
    addons,
    quantity,
    note: note?.trim() ? note.trim() : undefined,
  };
}
