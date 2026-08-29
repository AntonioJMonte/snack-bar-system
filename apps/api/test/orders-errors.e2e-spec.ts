import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { postOrder, seedCatalog, seedOpenAllDay, seedUser, truncateAll } from './seed';

// Caminhos de erro do POST /orders via HTTP real: cada bloqueio com código
// específico, e NENHUM pedido criado (dívida apontada no relatório da sessão 01).

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;

const RANDOM_UUID = '01890a5d-ac96-774b-bcce-b30209999999';

const validBody = (itemId: string, extra: Record<string, unknown> = {}) => ({
  customerName: 'Maria',
  customerPhone: '(11) 98765-4321',
  deliveryType: 'pickup',
  items: [{ itemId, quantity: 1 }],
  ...extra,
});

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

async function expectBlockedWith(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  const body = await response.json();
  expect(JSON.stringify(body)).toContain(code);
  expect(await prisma.order.count()).toBe(0);
}

describe('POST /orders — bloqueios (e2e)', () => {
  it('item esgotado: 422 ITEM_SOLD_OUT identificando o item', async () => {
    const { item } = await seedCatalog(prisma, { soldOut: true });
    await seedOpenAllDay(prisma);
    const response = await postOrder(baseUrl, validBody(item.id));
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string; details: { itemName: string } };
    expect(body.code).toBe('ITEM_SOLD_OUT');
    expect(body.details.itemName).toBe('X-Burger');
    expect(await prisma.order.count()).toBe(0);
  });

  it('item inexistente: 422 ITEM_NOT_FOUND', async () => {
    await seedCatalog(prisma);
    await seedOpenAllDay(prisma);
    const response = await postOrder(baseUrl, validBody(RANDOM_UUID));
    await expectBlockedWith(response, 422, 'ITEM_NOT_FOUND');
  });

  it('item inativo: 422 ITEM_INACTIVE', async () => {
    const { item } = await seedCatalog(prisma, { active: false });
    await seedOpenAllDay(prisma);
    const response = await postOrder(baseUrl, validBody(item.id));
    await expectBlockedWith(response, 422, 'ITEM_INACTIVE');
  });

  it('adicional de outro item: 422 ADDON_NOT_FOR_ITEM', async () => {
    const { item } = await seedCatalog(prisma);
    await seedOpenAllDay(prisma);
    const response = await postOrder(
      baseUrl,
      validBody(item.id, { items: [{ itemId: item.id, quantity: 1, addonIds: [RANDOM_UUID] }] }),
    );
    await expectBlockedWith(response, 422, 'ADDON_NOT_FOR_ITEM');
  });

  it('loja fechada por horário: 422 STORE_CLOSED com origem scheduled', async () => {
    const { item } = await seedCatalog(prisma);
    // nenhum horário cadastrado → fechada pelo programado
    const response = await postOrder(baseUrl, validBody(item.id));
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string; details: { source: string } };
    expect(body.code).toBe('STORE_CLOSED');
    expect(body.details.source).toBe('scheduled');
    expect(await prisma.order.count()).toBe(0);
  });

  it('fechamento manual vence o horário programado: 422 com origem manual', async () => {
    const { item } = await seedCatalog(prisma);
    await seedOpenAllDay(prisma); // estaria aberta pelo horário…
    const user = await seedUser(prisma);
    await prisma.storeStatusOverride.create({
      data: {
        open: false,
        setById: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const response = await postOrder(baseUrl, validBody(item.id));
    expect(response.status).toBe(422);
    const body = (await response.json()) as { details: { source: string } };
    expect(body.details.source).toBe('manual');
    expect(await prisma.order.count()).toBe(0);
  });

  it('abertura manual vence o horário: pedido criado fora do horário programado', async () => {
    const { item } = await seedCatalog(prisma);
    // nenhum horário cadastrado, mas override aberto:
    const user = await seedUser(prisma);
    await prisma.storeStatusOverride.create({
      data: {
        open: true,
        setById: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const response = await postOrder(baseUrl, validBody(item.id));
    expect(response.status).toBe(201);
    expect(await prisma.order.count()).toBe(1);
  });

  it('override expirado é ignorado: volta a valer o horário programado', async () => {
    const { item } = await seedCatalog(prisma);
    const user = await seedUser(prisma);
    await prisma.storeStatusOverride.create({
      data: {
        open: true,
        setById: user.id,
        expiresAt: new Date(Date.now() - 1000), // já expirou
      },
    });
    const response = await postOrder(baseUrl, validBody(item.id));
    await expectBlockedWith(response, 422, 'STORE_CLOSED');
  });

  it('entrega com região aplica a taxa; sem endereço é 400 de validação', async () => {
    const { item } = await seedCatalog(prisma);
    await seedOpenAllDay(prisma);
    const region = await prisma.deliveryRegion.create({
      data: { name: 'Centro', feeCents: 700 },
    });

    const missingAddress = await postOrder(
      baseUrl,
      validBody(item.id, { deliveryType: 'delivery', regionId: region.id }),
    );
    await expectBlockedWith(missingAddress, 400, 'VALIDATION_ERROR');

    const ok = await postOrder(
      baseUrl,
      validBody(item.id, { deliveryType: 'delivery', regionId: region.id, address: 'Rua X, 123' }),
    );
    expect(ok.status).toBe(201);
    const saved = await prisma.order.findFirstOrThrow();
    expect(saved.deliveryFeeCents).toBe(700);
    expect(saved.totalCents).toBe(saved.subtotalNetCents + 700);
  });

  it('CHECK do banco rejeita desconto fora de 0–100 mesmo por SQL direto', async () => {
    await seedCatalog(prisma);
    await expect(
      prisma.$executeRawUnsafe(`UPDATE "items" SET "discount_percent" = 150`),
    ).rejects.toThrow(/items_discount_percent_range/);
    await expect(
      prisma.$executeRawUnsafe(`UPDATE "items" SET "discount_percent" = -1`),
    ).rejects.toThrow(/items_discount_percent_range/);
  });
});
