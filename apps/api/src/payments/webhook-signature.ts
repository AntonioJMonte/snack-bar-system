import { createHmac, timingSafeEqual } from 'node:crypto';

// Validação da assinatura do webhook do Mercado Pago (seção 12.1: validar a
// assinatura de TODO webhook antes de confiar em qualquer confirmação).
// Formato documentado pela MP: header `x-signature: ts=...,v1=...`, onde v1 é
// HMAC-SHA256 do manifesto `id:{data.id};request-id:{x-request-id};ts:{ts};`
// com o segredo configurado no painel da MP.

export interface SignatureInput {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string;
  secret: string;
  now?: Date; // injetável no teste
}

// Janela de frescor (decisão #36). Sem ela, uma assinatura capturada uma vez vale
// PARA SEMPRE: quem interceptar um webhook legítimo pode reenviá-lo meses depois.
// 5 minutos cobre atraso de rede e reenvio do gateway; a folga de 1 minuto para
// trás e para frente absorve relógio dessincronizado entre servidores.
export const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;
export const SIGNATURE_CLOCK_SKEW_MS = 60 * 1000;

// O `ts` do Mercado Pago é Unix. Documentação e integrações reais divergem entre
// segundos e milissegundos, então aceitamos os dois: abaixo de 10^12 é segundo.
function parseTimestamp(ts: string): number | null {
  const value = Number(ts);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

export function validateMercadoPagoSignature(input: SignatureInput): boolean {
  if (!input.xSignature || !input.xRequestId) return false;

  const parts = new Map(
    input.xSignature.split(',').map((part) => {
      const [key, ...rest] = part.split('=');
      return [key?.trim(), rest.join('=').trim()] as const;
    }),
  );
  const ts = parts.get('ts');
  const v1 = parts.get('v1');
  if (!ts || !v1) return false;

  const signedAt = parseTimestamp(ts);
  if (signedAt === null) return false;
  const now = (input.now ?? new Date()).getTime();
  const age = now - signedAt;
  if (age > SIGNATURE_MAX_AGE_MS || age < -SIGNATURE_CLOCK_SKEW_MS) return false;

  // A MP normaliza data.id alfanumérico para minúsculas no manifesto.
  const dataId = /[a-zA-Z]/.test(input.dataId) ? input.dataId.toLowerCase() : input.dataId;
  const manifest = `id:${dataId};request-id:${input.xRequestId};ts:${ts};`;
  const expected = createHmac('sha256', input.secret).update(manifest).digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
