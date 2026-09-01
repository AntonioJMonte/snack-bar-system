import { describe, expect, it } from 'vitest';
import { cartTotals, lineSignature, lineTotals, type CartLine } from './cart-math';

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    lineId: 'l1',
    itemId: 'i1',
    itemName: 'X-Burger',
    basePriceCents: 2000,
    discountPercent: 0,
    addons: [],
    quantity: 1,
    ...overrides,
  };
}

describe('lineTotals', () => {
  it('sem desconto, líquido é igual ao cheio', () => {
    const totals = lineTotals(line({ basePriceCents: 2000, quantity: 3 }));
    expect(totals.unitFullCents).toBe(2000);
    expect(totals.unitDiscountCents).toBe(0);
    expect(totals.unitNetCents).toBe(2000);
    expect(totals.lineNetCents).toBe(6000);
  });

  it('desconto de 15% grava os três valores e eles somam (plano 14.1)', () => {
    const totals = lineTotals(line({ basePriceCents: 2000, discountPercent: 15 }));
    expect(totals.unitFullCents).toBe(2000);
    expect(totals.unitDiscountCents).toBe(300);
    expect(totals.unitNetCents).toBe(1700);
    expect(totals.unitFullCents - totals.unitDiscountCents).toBe(totals.unitNetCents);
  });

  it('desconto de 100% zera o líquido e é aceito (plano 14.1)', () => {
    const totals = lineTotals(line({ basePriceCents: 2000, discountPercent: 100 }));
    expect(totals.unitDiscountCents).toBe(2000);
    expect(totals.unitNetCents).toBe(0);
  });

  it('adicionais somam ao valor cheio ANTES do desconto (seção 5.4)', () => {
    const totals = lineTotals(
      line({
        basePriceCents: 2000,
        discountPercent: 10,
        addons: [
          { id: 'a1', name: 'Bacon', priceCents: 500 },
          { id: 'a2', name: 'Cheddar', priceCents: 300 },
        ],
      }),
    );
    // Cheio = 2000 + 500 + 300 = 2800; desconto de 10% = 280.
    expect(totals.unitFullCents).toBe(2800);
    expect(totals.unitDiscountCents).toBe(280);
    expect(totals.unitNetCents).toBe(2520);
  });

  it('arredonda half-up POR UNIDADE e só então multiplica (decisão #7)', () => {
    // 15% de 1999 = 299,85 → half-up por unidade = 300. Em 3 unidades, 900.
    // Se arredondasse o total (15% de 5997 = 899,55 → 900) daria igual aqui,
    // mas o valor unitário gravado precisa ser 300, não 299,85.
    const totals = lineTotals(line({ basePriceCents: 1999, discountPercent: 15, quantity: 3 }));
    expect(totals.unitDiscountCents).toBe(300);
    expect(totals.unitNetCents).toBe(1699);
    expect(totals.lineDiscountCents).toBe(900);
    expect(totals.lineNetCents).toBe(5097);
  });

  it('arredondamento é half-up, não half-even nem truncamento', () => {
    // 50% de 1 centavo = 0,5 → half-up = 1.
    const totals = lineTotals(line({ basePriceCents: 1, discountPercent: 50 }));
    expect(totals.unitDiscountCents).toBe(1);
    expect(totals.unitNetCents).toBe(0);
  });
});

describe('cartTotals', () => {
  it('soma as linhas mantendo cheio, desconto e líquido coerentes', () => {
    const totals = cartTotals([
      line({ lineId: 'l1', basePriceCents: 2000, discountPercent: 15, quantity: 2 }),
      line({ lineId: 'l2', basePriceCents: 1000, discountPercent: 0, quantity: 1 }),
    ]);
    // Linha 1: cheio 4000, desconto 600, líquido 3400. Linha 2: 1000/0/1000.
    expect(totals.subtotalFullCents).toBe(5000);
    expect(totals.discountTotalCents).toBe(600);
    expect(totals.subtotalNetCents).toBe(4400);
    expect(totals.subtotalFullCents - totals.discountTotalCents).toBe(totals.subtotalNetCents);
    expect(totals.itemCount).toBe(3);
  });

  it('carrinho vazio soma zero', () => {
    expect(cartTotals([])).toEqual({
      subtotalFullCents: 0,
      discountTotalCents: 0,
      subtotalNetCents: 0,
      itemCount: 0,
    });
  });
});

describe('lineSignature', () => {
  it('trata como a mesma linha independente da ordem dos adicionais', () => {
    const a = lineSignature(
      line({
        addons: [
          { id: 'a1', name: 'Bacon', priceCents: 500 },
          { id: 'a2', name: 'Cheddar', priceCents: 300 },
        ],
      }),
    );
    const b = lineSignature(
      line({
        addons: [
          { id: 'a2', name: 'Cheddar', priceCents: 300 },
          { id: 'a1', name: 'Bacon', priceCents: 500 },
        ],
      }),
    );
    expect(a).toBe(b);
  });

  it('separa linhas com observações diferentes', () => {
    expect(lineSignature(line({ note: 'sem cebola' }))).not.toBe(
      lineSignature(line({ note: 'sem tomate' })),
    );
  });

  it('separa linhas com adicionais diferentes', () => {
    expect(
      lineSignature(line({ addons: [{ id: 'a1', name: 'Bacon', priceCents: 500 }] })),
    ).not.toBe(lineSignature(line({ addons: [] })));
  });
});
