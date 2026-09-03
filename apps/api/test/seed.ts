import * as argon2 from 'argon2';
import type { Role } from '@prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';

export const TEST_PASSWORD = 'senha-de-teste-123';
let cachedHash: string | undefined;

export async function truncateAll(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "order_item_addons","order_items","payments","orders","addons","items",` +
      `"categories","delivery_regions","store_schedules","store_status_overrides",` +
      `"audit_logs","panel_sessions","whatsapp_conversations","users" RESTART IDENTITY CASCADE`,
  );
}

export async function seedCatalog(
  prisma: PrismaService,
  itemOverrides: { soldOut?: boolean; active?: boolean; discountPercent?: number } = {},
) {
  const category = await prisma.category.create({
    data: { name: 'Lanches', displayOrder: 1 },
  });
  const item = await prisma.item.create({
    data: {
      name: 'X-Burger',
      priceCents: 1000,
      discountPercent: itemOverrides.discountPercent ?? 15,
      soldOut: itemOverrides.soldOut ?? false,
      active: itemOverrides.active ?? true,
      categoryId: category.id,
      addons: { create: [{ name: 'Bacon', priceCents: 200 }] },
    },
    include: { addons: true },
  });
  return { category, item, addon: item.addons[0] };
}

// Loja aberta o dia todo, todos os dias — para testes cujo alvo não é o horário.
export async function seedOpenAllDay(prisma: PrismaService) {
  await prisma.storeSchedule.createMany({
    data: Array.from({ length: 7 }, (_, day) => ({
      dayOfWeek: day,
      opensAt: '00:00',
      closesAt: '23:59',
    })),
  });
}

export async function seedUser(
  prisma: PrismaService,
  role: Role = 'manager',
  email = `${role}@teste.local`,
) {
  cachedHash ??= await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id });
  return prisma.user.create({
    data: { name: `Usuário ${role}`, email, passwordHash: cachedHash, role },
  });
}

export async function loginAs(baseUrl: string, email: string): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  if (response.status !== 200) throw new Error(`login falhou: ${response.status}`);
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

export function postOrder(baseUrl: string, body: unknown, idempotencyKey?: string) {
  return fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
}
