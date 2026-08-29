import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedCatalog, seedOpenAllDay, truncateAll } from './seed';

// Objetivo (Etapa 4): provar o pipeline completo — app real, migração aplicada
// em banco descartável, pedido criado via HTTP, estado persistido conferido.

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  await app.listen(0); // porta efêmera
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

async function seedOpenCatalog() {
  const seeded = await seedCatalog(prisma);
  await seedOpenAllDay(prisma);
  return seeded;
}

describe('POST /orders (e2e)', () => {
  it('cria pedido válido, congela os três valores e fecha a aritmética', async () => {
    const { item, addon } = await seedOpenCatalog();

    const response = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Maria da Silva',
        customerPhone: '(11) 98765-4321',
        deliveryType: 'pickup',
        items: [{ itemId: item.id, quantity: 2, addonIds: [addon.id], note: 'sem cebola' }],
        // Tentativa de forjar valores — devem ser ignorados, não lidos:
        totalCents: 1,
        subtotalNetCents: 1,
      }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string; number: number };

    const saved = await prisma.order.findUniqueOrThrow({
      where: { id: body.id },
      include: { items: { include: { addons: true } } },
    });

    // Estado inicial correto, não pago (decisão #14):
    expect(saved.status).toBe('pending_payment');
    expect(saved.channel).toBe('web');
    expect(saved.customerPhone).toBe('11987654321');
    expect(saved.number).toBeGreaterThan(0);

    // Os três valores congelados no item (seção 5.4):
    const line = saved.items[0];
    expect(line.itemName).toBe('X-Burger');
    expect(line.quantity).toBe(2);
    expect(line.unitFullPriceCents).toBe(1200); // 1000 + adicional 200
    expect(line.discountPercentApplied).toBe(15);
    expect(line.unitDiscountCents).toBe(180); // 1200 × 15% = 180 exato
    expect(line.unitNetPriceCents).toBe(1020);
    expect(line.note).toBe('sem cebola');
    expect(line.addons[0]).toMatchObject({ name: 'Bacon', priceCents: 200 });

    // Totais e consistência aritmética:
    expect(saved.subtotalFullCents).toBe(2400);
    expect(saved.discountTotalCents).toBe(360);
    expect(saved.subtotalNetCents).toBe(2040);
    expect(saved.deliveryFeeCents).toBe(0);
    expect(saved.totalCents).toBe(2040);
    expect(saved.subtotalFullCents - saved.discountTotalCents).toBe(saved.subtotalNetCents);
    expect(saved.subtotalNetCents + saved.deliveryFeeCents).toBe(saved.totalCents);

    // Valores forjados no payload não vazaram:
    expect(saved.totalCents).not.toBe(1);
  });

  it('rejeita pedido sem telefone com erro claro e não cria nada', async () => {
    const { item } = await seedOpenCatalog();

    const response = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Maria',
        deliveryType: 'pickup',
        items: [{ itemId: item.id, quantity: 1 }],
      }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { message: { code: string } };
    expect(JSON.stringify(body)).toContain('VALIDATION_ERROR');
    expect(await prisma.order.count()).toBe(0);
  });
});
