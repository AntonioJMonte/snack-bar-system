import { describe, expect, it } from 'vitest';
import { formatCents, parseReaisToCents } from './money';

describe('formatCents', () => {
  it('formata centavos exatos, sem ponto flutuante', () => {
    expect(formatCents(0)).toBe('R$ 0,00');
    expect(formatCents(1)).toBe('R$ 0,01');
    expect(formatCents(9)).toBe('R$ 0,09');
    expect(formatCents(10)).toBe('R$ 0,10');
    expect(formatCents(1234)).toBe('R$ 12,34');
  });

  it('separa milhar no padrão brasileiro', () => {
    expect(formatCents(100000)).toBe('R$ 1.000,00');
    expect(formatCents(123456789)).toBe('R$ 1.234.567,89');
  });

  it('preserva centavos que terminam em zero', () => {
    // O bug clássico de dividir por 100 e usar toFixed sem cuidado: "R$ 12,3".
    expect(formatCents(1230)).toBe('R$ 12,30');
    expect(formatCents(1200)).toBe('R$ 12,00');
  });

  it('formata valores negativos', () => {
    expect(formatCents(-500)).toBe('-R$ 5,00');
  });
});

describe('parseReaisToCents', () => {
  it('converte com vírgula ou ponto', () => {
    expect(parseReaisToCents('12,90')).toBe(1290);
    expect(parseReaisToCents('12.90')).toBe(1290);
  });

  it('completa um único dígito de centavos', () => {
    // "12,9" é doze reais e noventa centavos, não doze e nove.
    expect(parseReaisToCents('12,9')).toBe(1290);
  });

  it('aceita valor sem centavos', () => {
    expect(parseReaisToCents('12')).toBe(1200);
    expect(parseReaisToCents('0')).toBe(0);
  });

  it('não perde centavo por ponto flutuante', () => {
    // Number("8.29") * 100 dá 828.9999999999999 em JS; a conversão é inteira.
    expect(parseReaisToCents('8,29')).toBe(829);
    expect(parseReaisToCents('1234,56')).toBe(123456);
  });

  it('rejeita entrada inválida em vez de adivinhar', () => {
    expect(parseReaisToCents('abc')).toBeNull();
    expect(parseReaisToCents('')).toBeNull();
    expect(parseReaisToCents('-5,00')).toBeNull();
    expect(parseReaisToCents('12,345')).toBeNull();
  });

  it('ignora espaços em volta', () => {
    expect(parseReaisToCents('  7,50  ')).toBe(750);
  });
});
