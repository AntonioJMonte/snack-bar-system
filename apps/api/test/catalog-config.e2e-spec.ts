import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { loginAs, seedUser, truncateAll } from './seed';

// Cadastro do cardápio e configurações da loja (seções 5.5 e 5.7): gerente+,
// tudo auditado, permissão verificada no servidor.

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;

function api(path: string, token: string | null, method: string, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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

describe('cadastro do cardápio (e2e)', () => {
  it('gerente cria categoria, item com adicionais e edita — tudo auditado', async () => {
    await seedUser(prisma, 'manager');
    const token = await loginAs(baseUrl, 'manager@teste.local');

    const category = (await (
      await api('/menu/categories', token, 'POST', { name: 'Lanches', displayOrder: 1 })
    ).json()) as { id: string };

    const itemResponse = await api('/menu/items', token, 'POST', {
      name: 'X-Salada',
      priceCents: 1800,
      discountPercent: 10,
      categoryId: category.id,
      addons: [{ name: 'Bacon', priceCents: 300 }],
    });
    expect(itemResponse.status).toBe(201);
    const item = (await itemResponse.json()) as { id: string; addons: { id: string }[] };
    expect(item.addons).toHaveLength(1);

    const patched = await api(`/menu/items/${item.id}`, token, 'PATCH', { name: 'X-Salada Duplo' });
    expect(patched.status).toBe(200);

    const addonPatch = await api(`/menu/addons/${item.addons[0].id}`, token, 'PATCH', {
      priceCents: 350,
    });
    expect(addonPatch.status).toBe(200);

    const actions = (await prisma.auditLog.findMany()).map((a) => a.action).sort();
    expect(actions).toEqual([
      'addon.updated',
      'category.created',
      'item.created',
      'item.updated',
    ]);
  });

  it('cardápio público: sem token, só ativos, esgotado sinalizado', async () => {
    await seedUser(prisma, 'manager');
    const token = await loginAs(baseUrl, 'manager@teste.local');
    const category = (await (
      await api('/menu/categories', token, 'POST', { name: 'Lanches', displayOrder: 1 })
    ).json()) as { id: string };
    const item = (await (
      await api('/menu/items', token, 'POST', {
        name: 'Visível',
        priceCents: 1000,
        categoryId: category.id,
        addons: [{ name: 'Bacon', priceCents: 300 }],
      })
    ).json()) as { id: string };
    const hidden = (await (
      await api('/menu/items', token, 'POST', { name: 'Oculto', priceCents: 500, categoryId: category.id })
    ).json()) as { id: string };
    await api(`/menu/items/${hidden.id}`, token, 'PATCH', { active: false });
    await api(`/menu/items/${item.id}/sold-out`, token, 'PATCH', { soldOut: true });

    const publicMenu = await fetch(`${baseUrl}/menu`);
    expect(publicMenu.status).toBe(200);
    const catalog = (await publicMenu.json()) as Array<{
      items: Array<{ name: string; soldOut: boolean; addons: unknown[] }>;
    }>;
    expect(catalog).toHaveLength(1);
    expect(catalog[0].items).toHaveLength(1); // inativo não aparece
    expect(catalog[0].items[0]).toMatchObject({ name: 'Visível', soldOut: true });
    expect(catalog[0].items[0].addons).toHaveLength(1);
  });

  it('atendente não cadastra nada: 403 em categoria e item', async () => {
    await seedUser(prisma, 'attendant');
    const token = await loginAs(baseUrl, 'attendant@teste.local');
    expect(
      (await api('/menu/categories', token, 'POST', { name: 'X', displayOrder: 1 })).status,
    ).toBe(403);
    expect(
      (await api('/menu/items', token, 'POST', { name: 'X', priceCents: 100, categoryId: 'x' }))
        .status,
    ).toBe(403);
  });

  it('item em categoria inexistente: 404 identificável', async () => {
    await seedUser(prisma, 'manager');
    const token = await loginAs(baseUrl, 'manager@teste.local');
    const response = await api('/menu/items', token, 'POST', {
      name: 'Órfão',
      priceCents: 100,
      categoryId: '01890a5d-ac96-774b-bcce-b30209999999',
    });
    expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).toContain('CATEGORY_NOT_FOUND');
  });
});

describe('configurações da loja (e2e)', () => {
  it('gerente substitui a semana de horários; formato inválido é rejeitado', async () => {
    await seedUser(prisma, 'manager');
    const token = await loginAs(baseUrl, 'manager@teste.local');

    const put = await api('/store/schedules', token, 'PUT', {
      schedules: [
        { dayOfWeek: 5, opensAt: '18:00', closesAt: '23:00' },
        { dayOfWeek: 6, opensAt: '18:00', closesAt: '23:30' },
      ],
    });
    expect(put.status).toBe(200);
    expect(await prisma.storeSchedule.count()).toBe(2);

    // Substituição total: novo PUT com um dia só deixa um registro.
    await api('/store/schedules', token, 'PUT', {
      schedules: [{ dayOfWeek: 0, opensAt: '11:00', closesAt: '15:00' }],
    });
    expect(await prisma.storeSchedule.count()).toBe(1);
    await prisma.auditLog.findFirstOrThrow({ where: { action: 'store.schedule_changed' } });

    const invalid = await api('/store/schedules', token, 'PUT', {
      schedules: [{ dayOfWeek: 1, opensAt: '25:00', closesAt: '26:00' }],
    });
    expect(invalid.status).toBe(400);

    const inverted = await api('/store/schedules', token, 'PUT', {
      schedules: [{ dayOfWeek: 1, opensAt: '20:00', closesAt: '18:00' }],
    });
    expect(inverted.status).toBe(400);
  });

  it('regiões de entrega: gerente cria e edita taxa com auditoria; atendente não', async () => {
    await seedUser(prisma, 'manager');
    await seedUser(prisma, 'attendant');
    const manager = await loginAs(baseUrl, 'manager@teste.local');
    const attendant = await loginAs(baseUrl, 'attendant@teste.local');

    const created = await api('/store/regions', manager, 'POST', { name: 'Centro', feeCents: 500 });
    expect(created.status).toBe(201);
    const region = (await created.json()) as { id: string };

    const updated = await api(`/store/regions/${region.id}`, manager, 'PATCH', { feeCents: 700 });
    expect(updated.status).toBe(200);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'region.updated' } });
    expect(audit.oldValue).toEqual({ feeCents: 500 });
    expect(audit.newValue).toEqual({ feeCents: 700 });

    expect((await api('/store/regions', attendant, 'POST', { name: 'X', feeCents: 1 })).status).toBe(403);
  });
});
