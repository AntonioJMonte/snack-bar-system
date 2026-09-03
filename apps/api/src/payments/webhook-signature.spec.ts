import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SIGNATURE_MAX_AGE_MS, validateMercadoPagoSignature } from './webhook-signature';

const SECRET = 'segredo-teste';
// Relógio fixo: os casos abaixo testam a ASSINATURA, então o tempo é congelado
// no instante do ts para que a janela de frescor não interfira.
const NOW = new Date(1_700_000_000_000);

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
        now: NOW,
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
        now: NOW,
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
        now: NOW,
      }),
    ).toBe(false);
  });

  it('rejeita cabeçalhos ausentes ou malformados', () => {
    expect(
      validateMercadoPagoSignature({ xSignature: undefined, xRequestId: 'r', dataId: '1', secret: SECRET, now: NOW }),
    ).toBe(false);
    expect(
      validateMercadoPagoSignature({ xSignature: 'ts=1', xRequestId: 'r', dataId: '1', secret: SECRET, now: NOW }),
    ).toBe(false);
    expect(
      validateMercadoPagoSignature({ xSignature: 'lixo', xRequestId: 'r', dataId: '1', secret: SECRET, now: NOW }),
    ).toBe(false);
  });

  // Janela de frescor (decisão #36): sem ela, uma assinatura capturada valeria
  // para sempre e poderia ser reenviada meses depois.
  it('rejeita assinatura válida porém velha demais', () => {
    const v1 = sign('12345', 'req-1', '1700000000');
    const bemDepois = new Date(1_700_000_000_000 + SIGNATURE_MAX_AGE_MS + 1_000);
    expect(
      validateMercadoPagoSignature({
        xSignature: `ts=1700000000,v1=${v1}`,
        xRequestId: 'req-1',
        dataId: '12345',
        secret: SECRET,
        now: bemDepois,
      }),
    ).toBe(false);
  });

  it('aceita dentro da janela e tolera relógio adiantado do gateway', () => {
    const v1 = sign('12345', 'req-1', '1700000000');
    const quaseNoLimite = new Date(1_700_000_000_000 + SIGNATURE_MAX_AGE_MS - 1_000);
    expect(
      validateMercadoPagoSignature({
        xSignature: `ts=1700000000,v1=${v1}`,
        xRequestId: 'req-1',
        dataId: '12345',
        secret: SECRET,
        now: quaseNoLimite,
      }),
    ).toBe(true);

    // Gateway 30s à frente do nosso relógio: continua válido (folga de 1 min).
    expect(
      validateMercadoPagoSignature({
        xSignature: `ts=1700000000,v1=${v1}`,
        xRequestId: 'req-1',
        dataId: '12345',
        secret: SECRET,
        now: new Date(1_700_000_000_000 - 30_000),
      }),
    ).toBe(true);
  });

  it('aceita ts em milissegundos, formato que algumas integrações enviam', () => {
    const v1 = sign('12345', 'req-1', '1700000000000');
    expect(
      validateMercadoPagoSignature({
        xSignature: `ts=1700000000000,v1=${v1}`,
        xRequestId: 'req-1',
        dataId: '12345',
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(true);
  });

  it('normaliza data.id alfanumérico para minúsculas, como a MP', () => {
    const v1 = sign('ABC123', 'req-1', '1700000000');
    expect(
      validateMercadoPagoSignature({
        xSignature: `ts=1700000000,v1=${v1}`,
        xRequestId: 'req-1',
        dataId: 'ABC123',
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(true);
  });
});
