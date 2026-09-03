import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { MercadoPagoClient } from '../src/payments/gateway';
import { PrismaService } from '../src/prisma/prisma.service';
import { postOrder, seedCatalog, seedOpenAllDay, truncateAll } from './seed';

// Cliente com internet instável clica "finalizar pedido", não vê resposta e
// clica de novo. Sem a chave de idempotência, cada clique vira um pedido, uma
// cobrança e mais confusão na cozinha (decisão #33).

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;
let createCheckoutCalls: number;

beforeAll(async () => {
  createCheckoutCalls = 0;
  const fakeGateway = {
    async createCheckout() {
      createCheckoutCalls += 1;
      return { initPoint: `https://fake.mercadopago/checkout/${createCheckoutCalls}` };
    },
    async getPayment() {
      throw new Error('não usado neste arquivo');
    },
    async searchPaymentsByReference() {
      return [];
    },
  };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MercadoPagoClient)
    .useValue(fakeGateway)
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  await app.listen(0);
  baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await truncateAll(prisma);
  createCheckoutCalls = 0;
});

async function orderBody() {
  const { item } = await seedCatalog(prisma);
  await seedOpenAllDay(prisma);
  return {
    customerName: 'Maria',
    customerPhone: '11987654321',
    deliveryType: 'pickup' as const,
    items: [{ itemId: item.id, quantity: 2 }],
  };
}

describe('Idempotency-Key em POST /orders (e2e)', () => {
  it('três cliques SIMULTÂNEOS com a mesma chave criam exatamente UM pedido', async () => {
    const body = await orderBody();
    const key = randomUUID();

    const responses = await Promise.all([
      postOrder(baseUrl, body, key),
      postOrder(baseUrl, body, key),
      postOrder(baseUrl, body, key),
    ]);
    const bodies = (await Promise.all(responses.map((r) => r.json()))) as { id: string }[];

    const ids = new Set(bodies.map((b) => b.id));
    expect(ids.size, `devolveu ${ids.size} pedidos diferentes: ${[...ids].join(', ')}`).toBe(1);
    expect(await prisma.order.count()).toBe(1);

    // Exatamente um 201 (quem criou) e dois 200 (quem recebeu o que já existia).
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 200, 201]);
  });

  it('clique repetido DEPOIS da resposta devolve o mesmo pedido com 200', async () => {
    const body = await orderBody();
    const key = randomUUID();

    const first = await postOrder(baseUrl, body, key);
    expect(first.status).toBe(201);
    const created = (await first.json()) as { id: string; number: number };

    const second = await postOrder(baseUrl, body, key);
    expect(second.status).toBe(200);
    const reused = (await second.json()) as { id: string; number: number };

    expect(reused.id).toBe(created.id);
    expect(reused.number).toBe(created.number);
    expect(await prisma.order.count()).toBe(1);
  });

  it('sem cabeçalho continua criando normalmente — compatibilidade preservada', async () => {
    const body = await orderBody();
    const a = await postOrder(baseUrl, body);
    const b = await postOrder(baseUrl, body);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(await prisma.order.count()).toBe(2);
  });

  it('chaves diferentes criam pedidos diferentes', async () => {
    const body = await orderBody();
    await postOrder(baseUrl, body, randomUUID());
    await postOrder(baseUrl, body, randomUUID());
    expect(await prisma.order.count()).toBe(2);
  });
});

describe('reaproveitamento da preferência de checkout (e2e)', () => {
  it('dois checkouts do mesmo pedido devolvem o MESMO initPoint e criam UMA preferência', async () => {
    const body = await orderBody();
    const created = (await (await postOrder(baseUrl, body)).json()) as { id: string };

    const first = (await (
      await fetch(`${baseUrl}/payments/checkout/${created.id}`, { method: 'POST' })
    ).json()) as { initPoint: string };
    const second = (await (
      await fetch(`${baseUrl}/payments/checkout/${created.id}`, { method: 'POST' })
    ).json()) as { initPoint: string };

    expect(second.initPoint).toBe(first.initPoint);
    expect(
      createCheckoutCalls,
      `o gateway foi chamado ${createCheckoutCalls}x — esperado 1`,
    ).toBe(1);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: created.id } });
    expect(order.checkoutInitPoint).toBe(first.initPoint);
  });
});
