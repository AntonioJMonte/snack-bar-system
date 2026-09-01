// Regra ÚNICA de arredondamento (decisão #7): half-up, aplicada POR UNIDADE.
// Aritmética 100% inteira, em centavos — ponto flutuante é proibido (seção 11).
// Vive em @lanchonete/contracts (decisão #24) para que API e web exibam
// exatamente os mesmos números; o valor que VALE é sempre o do servidor.

function assertNonNegativeInt(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${label} deve ser inteiro não negativo, recebido: ${value}`);
  }
}

// floor((n*p + 50) / 100) é half-up exato de (n*p)/100 usando só inteiros.
export function unitDiscountCents(unitFullCents: number, percent: number): number {
  assertNonNegativeInt(unitFullCents, 'unitFullCents');
  assertNonNegativeInt(percent, 'percent');
  if (percent > 100) throw new TypeError(`percent deve ser 0..100, recebido: ${percent}`);
  return Math.floor((unitFullCents * percent + 50) / 100);
}

export interface PricedUnit {
  unitFullCents: number;
  discountPercentApplied: number;
  unitDiscountCents: number;
  unitNetCents: number;
}

// Adicionais somam ao valor cheio ANTES do desconto (seção 5.4).
export function priceUnit(
  basePriceCents: number,
  addonPricesCents: number[],
  discountPercent: number,
): PricedUnit {
  const unitFullCents = addonPricesCents.reduce((sum, p) => {
    assertNonNegativeInt(p, 'addonPriceCents');
    return sum + p;
  }, basePriceCents);
  const discount = unitDiscountCents(unitFullCents, discountPercent);
  return {
    unitFullCents,
    discountPercentApplied: discountPercent,
    unitDiscountCents: discount,
    unitNetCents: unitFullCents - discount,
  };
}
