import { describe, expect, it } from 'vitest';
import { priceUnit, unitDiscountCents } from './pricing';

describe('unitDiscountCents — regra única de arredondamento (half-up por unidade)', () => {
  it('desconto de 0% resulta em zero', () => {
    expect(unitDiscountCents(1000, 0)).toBe(0);
  });

  it('desconto de 100% resulta no valor cheio', () => {
    expect(unitDiscountCents(1000, 100)).toBe(1000);
  });

  it('15% de 1200 = 180 (exato)', () => {
    expect(unitDiscountCents(1200, 15)).toBe(180);
  });

  it('arredonda meio para cima: 1% de 50 centavos = 0,5 → 1', () => {
    expect(unitDiscountCents(50, 1)).toBe(1);
  });

  it('33% de 999 = 329,67 → 330 (caso que expõe a regra da decisão #7)', () => {
    expect(unitDiscountCents(999, 33)).toBe(330);
  });

  it('arredonda para baixo quando fração < 0,5: 33% de 998 = 329,34 → 329', () => {
    expect(unitDiscountCents(998, 33)).toBe(329);
  });

  it('rejeita valores não inteiros (ponto flutuante proibido)', () => {
    expect(() => unitDiscountCents(10.5, 10)).toThrow(TypeError);
    expect(() => unitDiscountCents(1000, 10.5)).toThrow(TypeError);
  });

  it('rejeita percentual fora de 0..100 e valores negativos', () => {
    expect(() => unitDiscountCents(1000, 101)).toThrow(TypeError);
    expect(() => unitDiscountCents(1000, -1)).toThrow(TypeError);
    expect(() => unitDiscountCents(-100, 10)).toThrow(TypeError);
  });
});

describe('priceUnit — adicionais somam ao valor cheio ANTES do desconto', () => {
  it('item 1000 + adicional 200 com 15%: cheio 1200, desconto 180, líquido 1020', () => {
    expect(priceUnit(1000, [200], 15)).toEqual({
      unitFullCents: 1200,
      discountPercentApplied: 15,
      unitDiscountCents: 180,
      unitNetCents: 1020,
    });
  });

  it('desconto de 100% zera o líquido, com adicionais incluídos', () => {
    const priced = priceUnit(1000, [200, 300], 100);
    expect(priced.unitNetCents).toBe(0);
    expect(priced.unitDiscountCents).toBe(1500);
  });

  it('sem adicionais e sem desconto, líquido = preço base', () => {
    expect(priceUnit(2550, [], 0).unitNetCents).toBe(2550);
  });
});
