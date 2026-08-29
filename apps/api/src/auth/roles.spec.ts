import { describe, expect, it } from 'vitest';
import { roleAtLeast } from './roles';

describe('roleAtLeast — hierarquia da seção 5.5', () => {
  it('atendente só alcança atendente', () => {
    expect(roleAtLeast('attendant', 'attendant')).toBe(true);
    expect(roleAtLeast('attendant', 'manager')).toBe(false);
    expect(roleAtLeast('attendant', 'admin')).toBe(false);
  });

  it('gerente alcança atendente e gerente, não admin', () => {
    expect(roleAtLeast('manager', 'attendant')).toBe(true);
    expect(roleAtLeast('manager', 'manager')).toBe(true);
    expect(roleAtLeast('manager', 'admin')).toBe(false);
  });

  it('admin alcança tudo', () => {
    expect(roleAtLeast('admin', 'attendant')).toBe(true);
    expect(roleAtLeast('admin', 'manager')).toBe(true);
    expect(roleAtLeast('admin', 'admin')).toBe(true);
  });
});
