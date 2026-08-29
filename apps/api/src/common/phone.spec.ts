import { describe, expect, it } from 'vitest';
import { normalizeBrazilianPhone } from './phone';

describe('normalizeBrazilianPhone', () => {
  it('aceita celular com DDD, com e sem máscara', () => {
    expect(normalizeBrazilianPhone('11987654321')).toBe('11987654321');
    expect(normalizeBrazilianPhone('(11) 98765-4321')).toBe('11987654321');
  });

  it('aceita e remove o código do país 55', () => {
    expect(normalizeBrazilianPhone('+55 11 98765-4321')).toBe('11987654321');
    expect(normalizeBrazilianPhone('5511987654321')).toBe('11987654321');
  });

  it('aceita telefone fixo com DDD (10 dígitos, terceiro dígito 2–5)', () => {
    expect(normalizeBrazilianPhone('1132654321')).toBe('1132654321');
  });

  it('rejeita número sem DDD', () => {
    expect(normalizeBrazilianPhone('987654321')).toBeNull();
    expect(normalizeBrazilianPhone('8765-4321')).toBeNull();
  });

  it('rejeita DDD inválido (zero no primeiro ou segundo dígito)', () => {
    expect(normalizeBrazilianPhone('0187654321')).toBeNull();
    expect(normalizeBrazilianPhone('10987654321')).toBeNull();
  });

  it('rejeita celular de 11 dígitos que não começa com 9', () => {
    expect(normalizeBrazilianPhone('11887654321')).toBeNull();
  });

  it('rejeita fixo que começa com dígito fora de 2–5', () => {
    expect(normalizeBrazilianPhone('1192654321')).toBeNull();
  });

  it('rejeita entradas sem dígitos suficientes ou com lixo', () => {
    expect(normalizeBrazilianPhone('')).toBeNull();
    expect(normalizeBrazilianPhone('abc')).toBeNull();
    expect(normalizeBrazilianPhone('119876543210')).toBeNull();
  });
});
