import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateMercadoPagoSignature } from './webhook-signature';

const SECRET = 'segredo-teste';

function sign(dataId: string, requestId: string, ts: string, secret = SECRET) {
  const normalized = /[a-zA-Z]/.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${normalized};request-id:${requestId};ts:${ts};`;
  return createHmac('sha256', secret).update(manifest).digest('hex');
}

describe('validateMercadoPagoSignature', () => {
  it('aceita assinatura válida', () => {
    const v1 = sign('12345', 'req-1', '1700000000');
    expect(
      validateMercadoPagoSignature({
        xSignature: `ts=1700000000,v1=${v1}`,
        xRequestId: 'req-1',
        dataId: '12345',
        secret: SECRET,
      }),
    ).toBe(true);
  });

  it('rejeita assinatura com segredo errado', () => {
    const v1 = sign('12345', 'req-1', '1700000000', 'outro-segredo');
    expect(
      validateMercadoPagoSignature({
        xSignature: `ts=1700000000,v1=${v1}`,
        xRequestId: 'req-1',
        dataId: '12345',
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejeita quando o data.id foi adulterado', () => {
    const v1 = sign('12345', 'req-1', '1700000000');
    expect(
      validateMercadoPagoSignature({
        xSignature: `ts=1700000000,v1=${v1}`,
        xRequestId: 'req-1',
        dataId: '99999',
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejeita cabeçalhos ausentes ou malformados', () => {
    expect(
      validateMercadoPagoSignature({ xSignature: undefined, xRequestId: 'r', dataId: '1', secret: SECRET }),
    ).toBe(false);
    expect(
      validateMercadoPagoSignature({ xSignature: 'ts=1', xRequestId: 'r', dataId: '1', secret: SECRET }),
    ).toBe(false);
    expect(
      validateMercadoPagoSignature({ xSignature: 'lixo', xRequestId: 'r', dataId: '1', secret: SECRET }),
    ).toBe(false);
  });

  it('normaliza data.id alfanumérico para minúsculas, como a MP', () => {
    const v1 = sign('ABC123', 'req-1', '1700000000');
    expect(
      validateMercadoPagoSignature({
        xSignature: `ts=1700000000,v1=${v1}`,
        xRequestId: 'req-1',
        dataId: 'ABC123',
        secret: SECRET,
      }),
    ).toBe(true);
  });
});
