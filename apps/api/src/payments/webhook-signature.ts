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

  // A MP normaliza data.id alfanumérico para minúsculas no manifesto.
  const dataId = /[a-zA-Z]/.test(input.dataId) ? input.dataId.toLowerCase() : input.dataId;
  const manifest = `id:${dataId};request-id:${input.xRequestId};ts:${ts};`;
  const expected = createHmac('sha256', input.secret).update(manifest).digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
