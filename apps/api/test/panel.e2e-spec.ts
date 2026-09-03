import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  loginAs,
  postOrder,
  seedCatalog,
  seedOpenAllDay,
  seedUser,
  truncateAll,
} from './seed';

// Painel de produção (seção 8): lista ativa, aceite explícito e sinal de vida.

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;

function api(path: string, token: string | null, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function createPaidOrder(): Promise<string> {
  const { item } = await seedCatalog(prisma);
  await seedOpenAllDay(prisma);
  const response = await postOrder(baseUrl, {
    customerName: 'Maria',
    customerPhone: '11987654321',
    deliveryType: 'pickup',
    items: [{ itemId: item.id, quantity: 1 }],
  });
  const body = (await response.json()) as { id: string };
  // Estado pago simulado direto no banco: o caminho webhook→pago já é coberto
  // pelos e2e de pagamento.
  await prisma.order.update({ where: { id: body.id }, data: { status: 'awaiting_acceptance' } });
  return body.id;
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

describe('painel de produção (e2e)', () => {
  it('exige autenticação: sem token, 401', async () => {
    expect((await api('/panel/orders', null)).status).toBe(401);
    expect((await api('/panel/heartbeat', null, { method: 'POST', body: '{}' })).status).toBe(401);
  });

  it('lista pedidos ativos em ordem de chegada, com telefone e itens', async () => {
    const orderId = await createPaidOrder();
    const attendant = await seedUser(prisma, 'attendant');
    const token = await loginAs(baseUrl, attendant.email);

    const response = await api('/panel/orders', token);
    expect(response.status).toBe(200);
    const orders = (await response.json()) as Array<{
      id: string;
      customerPhone: string;
      items: unknown[];
    }>;
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe(orderId);
    expect(orders[0].customerPhone).toBe('11987654321');
    expect(orders[0].items).toHaveLength(1);
  });

  it('pedido pendente de pagamento NÃO aparece no painel', async () => {
    const { item } = await seedCatalog(prisma);
    await seedOpenAllDay(prisma);
    await postOrder(baseUrl, {
      customerName: 'Maria',
      customerPhone: '11987654321',
      deliveryType: 'pickup',
      items: [{ itemId: item.id, quantity: 1 }],
    });
    const attendant = await seedUser(prisma, 'attendant');
    const token = await loginAs(baseUrl, attendant.email);

    const orders = (await (await api('/panel/orders', token)).json()) as unknown[];
    expect(orders).toHaveLength(0); // só pedido PAGO alerta a loja (seção 6.1)
  });

  // A faixa "PAGAMENTO FORA DO PRAZO" do cartão do painel depende deste campo
  // chegar pela API. Como `paidAfterExpiryAt` é opcional no contrato, se a query
  // do painel deixar de trazê-lo o schema NÃO reclama — a faixa some em silêncio
  // e a loja volta a aceitar pedido velho sem saber (decisão #34).
  it('pedido pago após expirar chega ao painel COM a marca; pedido normal vem sem ela', async () => {
    const { item } = await seedCatalog(prisma);
    await seedOpenAllDay(prisma);
    const criar = async () => {
      const response = await postOrder(baseUrl, {
        customerName: 'Maria',
        customerPhone: '11987654321',
        deliveryType: 'pickup',
        items: [{ itemId: item.id, quantity: 1 }],
      });
      const { id } = (await response.json()) as { id: string };
      await prisma.order.update({ where: { id }, data: { status: 'awaiting_acceptance' } });
      return id;
    };

    const normalId = await criar();
    const tardioId = await criar();
    const marcadoEm = new Date();
    await prisma.order.update({
      where: { id: tardioId },
      data: { paidAfterExpiryAt: marcadoEm },
    });

    const attendant = await seedUser(prisma, 'attendant');
    const token = await loginAs(baseUrl, attendant.email);

    const orders = (await (await api('/panel/orders', token)).json()) as Array<{
      id: string;
      paidAfterExpiryAt: string | null;
    }>;

    const tardio = orders.find((o) => o.id === tardioId);
    const normal = orders.find((o) => o.id === normalId);
    expect(tardio?.paidAfterExpiryAt).toBe(marcadoEm.toISOString());
    // O contrário também importa: se o campo viesse sempre preenchido, a faixa
    // apareceria em todo pedido e deixaria de significar alguma coisa.
    expect(normal?.paidAfterExpiryAt).toBeNull();
  });

  it('aceite explícito registra quem e quando; segundo aceite é rejeitado', async () => {
    const orderId = await createPaidOrder();
    const attendant = await seedUser(prisma, 'attendant');
    const token = await loginAs(baseUrl, attendant.email);

    const accept = await api(`/panel/orders/${orderId}/accept`, token, { method: 'POST' });
    expect(accept.status).toBe(201);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('accepted');
    expect(order.acceptedById).toBe(attendant.id);
    expect(order.acceptedAt).not.toBeNull();

    // Aceite duplo: transição inválida, estado preservado (um aceite, um registro).
    const again = await api(`/panel/orders/${orderId}/accept`, token, { method: 'POST' });
    expect(again.status).toBe(422);
    expect(JSON.stringify(await again.json())).toContain('INVALID_STATUS_TRANSITION');
    const unchanged = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(unchanged.acceptedById).toBe(attendant.id);
  });

  it('não aceita pedido ainda não pago', async () => {
    const { item } = await seedCatalog(prisma);
    await seedOpenAllDay(prisma);
    const response = await postOrder(baseUrl, {
      customerName: 'Maria',
      customerPhone: '11987654321',
      deliveryType: 'pickup',
      items: [{ itemId: item.id, quantity: 1 }],
    });
    const { id } = (await response.json()) as { id: string };
    const attendant = await seedUser(prisma, 'attendant');
    const token = await loginAs(baseUrl, attendant.email);

    const accept = await api(`/panel/orders/${id}/accept`, token, { method: 'POST' });
    expect(accept.status).toBe(422);
  });

  it('avança status passo a passo; retirada pula a_caminho; salto e retrocesso são rejeitados', async () => {
    const orderId = await createPaidOrder(); // retirada
    const attendant = await seedUser(prisma, 'attendant');
    const token = await loginAs(baseUrl, attendant.email);
    const advance = (status: string) =>
      api(`/panel/orders/${orderId}/status`, token, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });

    // Antes do aceite, não avança:
    expect((await advance('preparing')).status).toBe(422);
    await api(`/panel/orders/${orderId}/accept`, token, { method: 'POST' });

    // Pular etapa: rejeitado.
    expect((await advance('ready')).status).toBe(422);
    expect((await advance('preparing')).status).toBe(201);
    expect((await advance('ready')).status).toBe(201);

    // Retirada não tem "a caminho" (decisão #19):
    const wrong = await advance('out_for_delivery');
    expect(wrong.status).toBe(422);
    expect(JSON.stringify(await wrong.json())).toContain('INVALID_STATUS_TRANSITION');

    expect((await advance('completed')).status).toBe(201);
    const done = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(done.status).toBe('completed');

    // Concluído não avança nem retrocede:
    expect((await advance('preparing')).status).toBe(422);
    // E some da lista ativa do painel:
    const active = (await (await api('/panel/orders', token)).json()) as unknown[];
    expect(active).toHaveLength(0);
  });

  it('entrega passa por a_caminho antes de concluir', async () => {
    const { item } = await seedCatalog(prisma);
    await seedOpenAllDay(prisma);
    const region = await prisma.deliveryRegion.create({ data: { name: 'Centro', feeCents: 500 } });
    const response = await postOrder(baseUrl, {
      customerName: 'Maria',
      customerPhone: '11987654321',
      deliveryType: 'delivery',
      address: 'Rua X, 1',
      regionId: region.id,
      items: [{ itemId: item.id, quantity: 1 }],
    });
    const { id } = (await response.json()) as { id: string };
    await prisma.order.update({ where: { id }, data: { status: 'awaiting_acceptance' } });
    const attendant = await seedUser(prisma, 'attendant');
    const token = await loginAs(baseUrl, attendant.email);
    const advance = (status: string) =>
      api(`/panel/orders/${id}/status`, token, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });

    await api(`/panel/orders/${id}/accept`, token, { method: 'POST' });
    await advance('preparing');
    await advance('ready');
    expect((await advance('completed')).status).toBe(422); // não pula a_caminho
    expect((await advance('out_for_delivery')).status).toBe(201);
    expect((await advance('completed')).status).toBe(201);
  });

  it('cliente acompanha o pedido pelo UUID, sem dados operacionais', async () => {
    const orderId = await createPaidOrder();
    const response = await fetch(`${baseUrl}/orders/${orderId}/tracking`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown> & {
      items: Array<Record<string, unknown>>;
    };
    expect(body.status).toBe('awaiting_acceptance');
    expect(body.items[0]).toMatchObject({ itemName: 'X-Burger', quantity: 1 });
    expect(body).not.toHaveProperty('customerPhone');
    expect(body).not.toHaveProperty('acceptedById');

    const missing = await fetch(`${baseUrl}/orders/01890a5d-ac96-774b-bcce-b30209999999/tracking`);
    expect(missing.status).toBe(404);
  });

  it('heartbeat faz upsert por usuário+dispositivo e gerente vê os painéis ativos', async () => {
    const attendant = await seedUser(prisma, 'attendant');
    const manager = await seedUser(prisma, 'manager');
    const attendantToken = await loginAs(baseUrl, attendant.email);
    const managerToken = await loginAs(baseUrl, manager.email);

    // Duas batidas do mesmo dispositivo → um registro; som mudou de estado.
    await api('/panel/heartbeat', attendantToken, {
      method: 'POST',
      body: JSON.stringify({ device: 'pc-balcao', soundArmed: false }),
    });
    const second = await api('/panel/heartbeat', attendantToken, {
      method: 'POST',
      body: JSON.stringify({ device: 'pc-balcao', soundArmed: true }),
    });
    expect(second.status).toBe(201);
    expect(await prisma.panelSession.count()).toBe(1);
    const session = await prisma.panelSession.findFirstOrThrow();
    expect(session.soundArmed).toBe(true);

    // Painéis ativos: gerente vê; atendente não (seção 5.7 é painel admin).
    const sessions = await api('/panel/sessions', managerToken);
    expect(sessions.status).toBe(200);
    const list = (await sessions.json()) as Array<{ device: string; active: boolean }>;
    expect(list[0]).toMatchObject({ device: 'pc-balcao', active: true });

    expect((await api('/panel/sessions', attendantToken)).status).toBe(403);
  });
});
