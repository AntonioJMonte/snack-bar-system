import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { endOfStoreDay } from '../src/store/store-clock';
import {
  loginAs,
  postOrder,
  seedCatalog,
  seedOpenAllDay,
  seedUser,
  truncateAll,
} from './seed';
import { TEST_ENV } from './test-env';

// Permissões e auditoria (seções 5.5, 12.2 e plano de testes 14.2):
// autorização verificada NO SERVIDOR, chamando a API diretamente.

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;

function patch(path: string, token: string | null, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  await app.listen(0);
  const address = app.getHttpServer().address() as { port: number };
  baseUrl = `http://127.0.0.1:${address.port}`;
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

describe('login (e2e)', () => {
  it('credencial válida devolve token; senha errada é 401 sem detalhar o motivo', async () => {
    await seedUser(prisma, 'manager');
    const token = await loginAs(baseUrl, 'manager@teste.local');
    expect(token.length).toBeGreaterThan(20);

    const wrong = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'manager@teste.local', password: 'errada' }),
    });
    expect(wrong.status).toBe(401);
    expect(JSON.stringify(await wrong.json())).toContain('INVALID_CREDENTIALS');
  });
});

describe('permissões do cardápio (e2e)', () => {
  it('atendente NÃO altera preço pela API; gerente altera, com auditoria e histórico intacto', async () => {
    const { item } = await seedCatalog(prisma);
    await seedOpenAllDay(prisma);
    await seedUser(prisma, 'attendant');
    const manager = await seedUser(prisma, 'manager');

    // Pedido criado ANTES da mudança de preço, para provar o congelamento:
    const orderResponse = await postOrder(baseUrl, {
      customerName: 'Maria',
      customerPhone: '11987654321',
      deliveryType: 'pickup',
      items: [{ itemId: item.id, quantity: 1 }],
    });
    const orderBefore = (await orderResponse.json()) as { id: string };

    // Sem token: 401. Atendente: 403 — este é o teste que importa (14.2).
    expect((await patch(`/menu/items/${item.id}/price`, null, { priceCents: 1 })).status).toBe(401);
    const attendantToken = await loginAs(baseUrl, 'attendant@teste.local');
    const forbidden = await patch(`/menu/items/${item.id}/price`, attendantToken, { priceCents: 1 });
    expect(forbidden.status).toBe(403);
    expect(JSON.stringify(await forbidden.json())).toContain('INSUFFICIENT_ROLE');

    const managerToken = await loginAs(baseUrl, 'manager@teste.local');
    const ok = await patch(`/menu/items/${item.id}/price`, managerToken, { priceCents: 1500 });
    expect(ok.status).toBe(200);

    const updated = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.priceCents).toBe(1500);

    // Auditoria: quem, o quê, valor anterior e novo (seção 5.5).
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'item.price_changed' },
    });
    expect(audit.userId).toBe(manager.id);
    expect(audit.oldValue).toEqual({ priceCents: 1000 });
    expect(audit.newValue).toEqual({ priceCents: 1500 });

    // Pedido antigo permanece exatamente como foi cobrado (5.4).
    const frozen = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: orderBefore.id },
    });
    expect(frozen.unitFullPriceCents).toBe(1000);
  });

  it('desconto de 150% ou negativo: rejeitado na validação', async () => {
    const { item } = await seedCatalog(prisma);
    await seedUser(prisma, 'manager');
    const token = await loginAs(baseUrl, 'manager@teste.local');

    expect((await patch(`/menu/items/${item.id}/discount`, token, { discountPercent: 150 })).status).toBe(400);
    expect((await patch(`/menu/items/${item.id}/discount`, token, { discountPercent: -1 })).status).toBe(400);
    const ok = await patch(`/menu/items/${item.id}/discount`, token, { discountPercent: 20 });
    expect(ok.status).toBe(200);
  });

  it('atendente PODE marcar esgotado (operação do dia a dia), com auditoria', async () => {
    const { item } = await seedCatalog(prisma);
    const attendant = await seedUser(prisma, 'attendant');
    const token = await loginAs(baseUrl, 'attendant@teste.local');

    const response = await patch(`/menu/items/${item.id}/sold-out`, token, { soldOut: true });
    expect(response.status).toBe(200);
    expect((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).soldOut).toBe(true);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'item.sold_out_changed' },
    });
    expect(audit.userId).toBe(attendant.id);
  });
});

describe('estado da loja (e2e)', () => {
  it('gerente fecha manualmente: pedido bloqueado, auditoria criada, expira ao fim do dia da loja', async () => {
    const { item } = await seedCatalog(prisma);
    await seedOpenAllDay(prisma);
    await seedUser(prisma, 'manager');
    const token = await loginAs(baseUrl, 'manager@teste.local');

    const before = Date.now();
    const response = await fetch(`${baseUrl}/store/override`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ open: false }),
    });
    expect(response.status).toBe(201);

    // Expiração = próxima meia-noite no fuso da loja (5.5).
    const override = await prisma.storeStatusOverride.findFirstOrThrow();
    const expected = endOfStoreDay(new Date(before), TEST_ENV.STORE_TIMEZONE);
    expect(Math.abs(override.expiresAt.getTime() - expected.getTime())).toBeLessThan(5000);

    const status = await fetch(`${baseUrl}/store/status`);
    expect(await status.json()).toEqual({ open: false, source: 'manual' });

    const blocked = await postOrder(baseUrl, {
      customerName: 'Maria',
      customerPhone: '11987654321',
      deliveryType: 'pickup',
      items: [{ itemId: item.id, quantity: 1 }],
    });
    expect(blocked.status).toBe(422);

    await prisma.auditLog.findFirstOrThrow({ where: { action: 'store.manual_override' } });
  });

  it('atendente não abre nem fecha a loja', async () => {
    await seedUser(prisma, 'attendant');
    const token = await loginAs(baseUrl, 'attendant@teste.local');
    const response = await fetch(`${baseUrl}/store/override`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ open: true }),
    });
    expect(response.status).toBe(403);
  });
});
