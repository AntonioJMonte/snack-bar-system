'use client';

// Identidade do dispositivo para o sinal de vida (seção 8.2): o painel
// administrativo precisa distinguir "PC do balcão" de "celular da loja".
// O nome é editável pela própria tela do painel; o padrão é um palpite legível.

const DEVICE_KEY = 'lanchonete.panel.device';

function guessDeviceName(): string {
  if (typeof navigator === 'undefined') return 'dispositivo';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return isMobile ? 'celular-da-loja' : 'pc-da-loja';
}

export function readDeviceName(): string {
  if (typeof window === 'undefined') return 'dispositivo';
  try {
    const stored = window.localStorage.getItem(DEVICE_KEY);
    if (stored) return stored;
  } catch {
    // Armazenamento bloqueado: usa o palpite a cada carga.
  }
  return guessDeviceName();
}

export function storeDeviceName(name: string): void {
  try {
    window.localStorage.setItem(DEVICE_KEY, name.trim().slice(0, 100));
  } catch {
    // Nada a fazer.
  }
}

// ─────────── Intervalo de repetição do alerta (decisão #27) ───────────
// Por dispositivo, dentro da faixa de 15 a 20 segundos da seção 8.2.

const INTERVAL_KEY = 'lanchonete.panel.alertInterval';
export const MIN_ALERT_SECONDS = 15;
export const MAX_ALERT_SECONDS = 20;
export const DEFAULT_ALERT_SECONDS = 15;

export function clampAlertSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_ALERT_SECONDS;
  return Math.min(MAX_ALERT_SECONDS, Math.max(MIN_ALERT_SECONDS, Math.round(seconds)));
}

export function readAlertSeconds(): number {
  if (typeof window === 'undefined') return DEFAULT_ALERT_SECONDS;
  try {
    const stored = window.localStorage.getItem(INTERVAL_KEY);
    if (stored === null) return DEFAULT_ALERT_SECONDS;
    return clampAlertSeconds(Number(stored));
  } catch {
    return DEFAULT_ALERT_SECONDS;
  }
}

export function storeAlertSeconds(seconds: number): number {
  const clamped = clampAlertSeconds(seconds);
  try {
    window.localStorage.setItem(INTERVAL_KEY, String(clamped));
  } catch {
    // Nada a fazer.
  }
  return clamped;
}
