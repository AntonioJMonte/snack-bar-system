import { describe, expect, it } from 'vitest';
import { reaisToCents } from './amount';

describe('reaisToCents — fronteira única com o decimal do gateway', () => {
  it('converte valores exatos', () => {
    expect(reaisToCents(20.4)).toBe(2040); // 20.4*100 = 2039.9999… em float
    expect(reaisToCents(0.1)).toBe(10);
    expect(reaisToCents(1234.56)).toBe(123456);
    expect(reaisToCents(0)).toBe(0);
  });

  it('rejeita valores inválidos', () => {
    expect(() => reaisToCents(-1)).toThrow(TypeError);
    expect(() => reaisToCents(Number.NaN)).toThrow(TypeError);
    expect(() => reaisToCents(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });
});
