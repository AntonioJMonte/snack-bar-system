import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { truncateAll } from './seed';

// O throttler fica DESLIGADO no resto da suíte (decisão #35): antes disto ela
// passava por margem — 12 de 20 chamadas no arquivo de pagamentos — e o próximo
// teste escrito quebraria com um 429 disfarçado de bug de pagamento.
// Este arquivo é a contrapartida: liga de propósito e prova que a configuração
// faz o que promete, para que desligar nos outros não vire ponto cego.

let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  process.env.THROTTLE_E2E = '1';
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  await app.listen(0);
  baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
  await truncateAll(app.get(PrismaService));
});

afterAll(async () => {
  await app.close();
  delete process.env.THROTTLE_E2E;
});

// Sequencial de propósito: em paralelo a ordem das respostas não é determinística
// e o teste passaria a depender de sorte para dizer QUANDO o bloqueio começou.
async function hit(path: string, times: number, init?: RequestInit): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < times; i += 1) {
    statuses.push((await fetch(`${baseUrl}${path}`, init)).status);
  }
  return statuses;
}

describe('rate limiting (e2e, throttler ligado)', () => {
  it('rota pública devolve 429 ao estourar o limite', async () => {
    const statuses = await hit('/menu', 130);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    // O limite do grupo é 120/min: os primeiros 120 passam.
    expect(statuses.slice(0, 120).every((s) => s === 200)).toBe(true);
    expect(statuses[statuses.length - 1]).toBe(429);
  });

  it('webhook NÃO é barrado no mesmo volume — limite próprio de 600/min', async () => {
    const statuses = await hit('/payments/webhook/mercadopago?type=payment&data.id=123', 130, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'payment', data: { id: '123' } }),
    });
    // Sem assinatura válida o webhook devolve 401 — o que importa é que NENHUMA
    // seja 429: um webhook barrado é um pagamento que nunca se confirma.
    expect(statuses.filter((s) => s === 429).length).toBe(0);
    expect(statuses.every((s) => s === 401)).toBe(true);
  });

  it('todo bloqueio vira log — rate limit não pode falhar em silêncio', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    await hit('/store/status', 130);
    const blocked = warn.mock.calls
      .map((call) => String(call[0]))
      .filter((message) => message.startsWith('throttle.blocked'));
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked[0]).toContain('route=/store/status');
    expect(blocked[0]).toContain('limit=120');
    warn.mockRestore();
  });
});
