import type { StoreOpenStatus } from '../orders/domain/build-order';
import type { StoreLocalParts } from './store-clock';

export interface OverrideData {
  open: boolean;
}

export interface ScheduleData {
  dayOfWeek: number;
  opensAt: string; // "HH:mm" local da loja
  closesAt: string; // "HH:mm"
}

// Precedência (seção 5.5): sobreposição manual não expirada VENCE o horário
// programado. Sem override vigente, vale o horário do dia da semana da loja.
export function resolveStoreStatus(
  override: OverrideData | null,
  schedules: ScheduleData[],
  parts: StoreLocalParts,
): StoreOpenStatus {
  if (override) {
    return { open: override.open, source: 'manual' };
  }
  const open = schedules.some(
    (s) => s.dayOfWeek === parts.dayOfWeek && s.opensAt <= parts.time && parts.time < s.closesAt,
  );
  return { open, source: 'scheduled' };
}
