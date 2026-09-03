import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { loginAs, postOrder, seedCatalog, seedOpenAllDay, seedUser, truncateAll } from './seed';

// Views de leitura do painel administrativo (seção 5.7):
//   GET /menu/catalog — catálogo COMPLETO, incluindo inativos (gerente+)
//   GET /orders       — registro definitivo da operação, incluindo concluídos (gerente+)

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;

function api(path: string, token: string | null) {
  return fetch(`${baseUrl}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
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

describe('GET /menu/catalog', () => {
  it('exige autenticação', async () => {
    const response = await api('/menu/catalog', null);
    expect(response.status).toBe(401);
  });

  it('rejeita atendente — cadastro é de gerente para cima', async () => {
    await seedUser(prisma, 'attendant');
    const token = await loginAs(baseUrl, 'attendant@teste.local');
    const response = await api('/menu/catalog', token);
    expect(response.status).toBe(403);
  });

  it('devolve ao gerente também os itens inativos e esgotados', async () => {
    // Sem isso não haveria como reativar pela interface o que foi desativado.
    const { category } = await seedCatalog(prisma, { active: false, soldOut: true });
    await seedUser(prisma, 'manager');
    const token = await loginAs(baseUrl, 'manager@teste.local');

    const response = await api('/menu/catalog', token);
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      id: string;
      items: { name: string; active: boolean; soldOut: boolean; addons: unknown[] }[];
    }[];

    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(category.id);
    expect(body[0].items).toHaveLength(1);
    expect(body[0].items[0].active).toBe(false);
    expect(body[0].items[0].soldOut).toBe(true);
    expect(body[0].items[0].addons).toHaveLength(1);
  });

  it('difere do cardápio público, que esconde o inativo', async () => {
    await seedCatalog(prisma, { active: false });
    const publicResponse = await fetch(`${baseUrl}/menu`);
    const publicBody = (await publicResponse.json()) as { items: unknown[] }[];
    // A categoria aparece, mas sem o item desativado.
    expect(publicBody[0].items).toHaveLength(0);
  });
});

describe('GET /orders', () => {
  async function createCompletedOrder() {
    const { item } = await seedCatalog(prisma);
    await seedOpenAllDay(prisma);
    const response = await postOrder(baseUrl, {
      customerName: 'Maria',
      customerPhone: '11987654321',
      deliveryType: 'pickup',
      items: [{ itemId: item.id, quantity: 1 }],
    });
    const order = (await response.json()) as { id: string };
    await prisma.order.update({ where: { id: order.id }, data: { status: 'completed' } });
    return order.id;
  }

  it('exige autenticação', async () => {
    const response = await api('/orders', null);
    expect(response.status).toBe(401);
  });

  it('rejeita atendente — histórico é de gerente para cima', async () => {
    await seedUser(prisma, 'attendant');
    const token = await loginAs(baseUrl, 'attendant@teste.local');
    const response = await api('/orders', token);
    expect(response.status).toBe(403);
  });

  it('inclui pedidos concluídos, que o painel de produção já não mostra', async () => {
    const orderId = await createCompletedOrder();
    await seedUser(prisma, 'manager');
    const token = await loginAs(baseUrl, 'manager@teste.local');

    const history = (await (await api('/orders', token)).json()) as { id: string }[];
    expect(history.map((o) => o.id)).toContain(orderId);

    // O painel de produção lista apenas os ativos — é essa a diferença.
    const panel = (await (await api('/panel/orders', token)).json()) as { id: string }[];
    expect(panel.map((o) => o.id)).not.toContain(orderId);
  });

  it('filtra por status', async () => {
    await createCompletedOrder();
    await seedUser(prisma, 'manager');
    const token = await loginAs(baseUrl, 'manager@teste.local');

    const completed = (await (await api('/orders?status=completed', token)).json()) as unknown[];
    expect(completed).toHaveLength(1);

    const preparing = (await (await api('/orders?status=preparing', token)).json()) as unknown[];
    expect(preparing).toHaveLength(0);
  });

  it('rejeita status inexistente em vez de ignorar o filtro', async () => {
    await seedUser(prisma, 'manager');
    const token = await loginAs(baseUrl, 'manager@teste.local');
    const response = await api('/orders?status=inventado', token);
    expect(response.status).toBe(400);
  });

  it('traz os valores congelados e o pagamento junto', async () => {
    await createCompletedOrder();
    await seedUser(prisma, 'manager');
    const token = await loginAs(baseUrl, 'manager@teste.local');

    const [order] = (await (await api('/orders', token)).json()) as {
      items: { unitFullPriceCents: number; discountPercentApplied: number; unitNetPriceCents: number }[];
      payments: unknown[];
    }[];

    // Item de 1000 com 15%: cheio 1000, desconto 150, líquido 850.
    expect(order.items[0].unitFullPriceCents).toBe(1000);
    expect(order.items[0].discountPercentApplied).toBe(15);
    expect(order.items[0].unitNetPriceCents).toBe(850);
    // Pedido nunca pago: a lista existe e vem VAZIA, não ausente (decisão #32).
    expect(order.payments).toEqual([]);
  });
});
