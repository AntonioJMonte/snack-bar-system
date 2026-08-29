import { describe, expect, it } from 'vitest';
import { storeLocalParts } from './store-clock';
import { resolveStoreStatus, type ScheduleData } from './store-status';

const schedules: ScheduleData[] = [
  { dayOfWeek: 5, opensAt: '18:00', closesAt: '23:00' }, // sexta
  { dayOfWeek: 6, opensAt: '18:00', closesAt: '23:30' }, // sábado
];

describe('resolveStoreStatus — precedência da seção 5.5', () => {
  it('sem override, dentro do horário do dia: aberta (scheduled)', () => {
    expect(resolveStoreStatus(null, schedules, { dayOfWeek: 5, time: '19:00' })).toEqual({
      open: true,
      source: 'scheduled',
    });
  });

  it('sem override, fora do horário: fechada (scheduled)', () => {
    expect(resolveStoreStatus(null, schedules, { dayOfWeek: 5, time: '23:30' }).open).toBe(false);
    expect(resolveStoreStatus(null, schedules, { dayOfWeek: 2, time: '19:00' }).open).toBe(false);
  });

  it('fechamento manual VENCE o horário programado', () => {
    expect(
      resolveStoreStatus({ open: false }, schedules, { dayOfWeek: 5, time: '19:00' }),
    ).toEqual({ open: false, source: 'manual' });
  });

  it('abertura manual VENCE o horário programado (fora do horário)', () => {
    expect(
      resolveStoreStatus({ open: true }, schedules, { dayOfWeek: 2, time: '03:00' }),
    ).toEqual({ open: true, source: 'manual' });
  });

  it('abre exatamente no horário de abertura, fecha exatamente no de fechamento', () => {
    expect(resolveStoreStatus(null, schedules, { dayOfWeek: 5, time: '18:00' }).open).toBe(true);
    expect(resolveStoreStatus(null, schedules, { dayOfWeek: 5, time: '23:00' }).open).toBe(false);
  });
});

describe('storeLocalParts — conversão UTC → fuso da loja (decisão #13)', () => {
  it('02:30 UTC de sábado é 23:30 de sexta em America/Sao_Paulo (UTC−3)', () => {
    // 2026-08-29 é sábado; em São Paulo ainda é sexta 23:30.
    expect(storeLocalParts(new Date('2026-08-29T02:30:00Z'), 'America/Sao_Paulo')).toEqual({
      dayOfWeek: 5,
      time: '23:30',
    });
  });

  it('meio-dia UTC converte direto no mesmo dia', () => {
    expect(storeLocalParts(new Date('2026-08-29T12:00:00Z'), 'America/Sao_Paulo')).toEqual({
      dayOfWeek: 6,
      time: '09:00',
    });
  });
});
