import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { loginAs, seedUser, truncateAll } from './seed';

// Gestão de usuários e consulta de auditoria: exclusivas do admin (seção 5.5).

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;

function api(path: string, token: string | null, method = 'GET', body?: unknown) {
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

describe('gestão de usuários (e2e)', () => {
  it('gerente NÃO cria usuário; admin cria, o novo usuário loga, e a senha não vaza', async () => {
    await seedUser(prisma, 'manager');
    await seedUser(prisma, 'admin');
    const managerToken = await loginAs(baseUrl, 'manager@teste.local');
    const adminToken = await loginAs(baseUrl, 'admin@teste.local');

    const payload = {
      name: 'Nova Atendente',
      email: 'nova@teste.local',
      password: 'senha-forte-8+',
      role: 'attendant',
    };

    // Gestão de usuários é exclusiva do administrador (plano de testes 14.2).
    expect((await api('/users', managerToken, 'POST', payload)).status).toBe(403);

    const created = await api('/users', adminToken, 'POST', payload);
    expect(created.status).toBe(201);
    const user = (await created.json()) as Record<string, unknown>;
    expect(user).not.toHaveProperty('passwordHash');
    expect(user.role).toBe('attendant');

    // A senha funciona e o hash é argon2:
    const token = await loginAs(baseUrl, 'nova@teste.local').catch(() => null);
    expect(token).toBeNull(); // loginAs usa TEST_PASSWORD — senha diferente
    const login = await api('/auth/login', null, 'POST', {
      email: 'nova@teste.local',
      password: 'senha-forte-8+',
    });
    expect(login.status).toBe(200);
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'nova@teste.local' } });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);

    // Auditoria de criação sem senha:
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'user.created' } });
    expect(JSON.stringify(audit.newValue)).not.toContain('senha');
    expect(audit.newValue).toEqual({
      name: 'Nova Atendente',
      email: 'nova@teste.local',
      role: 'attendant',
    });
  });

  it('e-mail duplicado: 409; desativação impede login', async () => {
    await seedUser(prisma, 'admin');
    const adminToken = await loginAs(baseUrl, 'admin@teste.local');
    const attendant = await seedUser(prisma, 'attendant');

    const dup = await api('/users', adminToken, 'POST', {
      name: 'Duplicada',
      email: attendant.email,
      password: 'senha-forte-8+',
      role: 'attendant',
    });
    expect(dup.status).toBe(409);

    const deactivate = await api(`/users/${attendant.id}`, adminToken, 'PATCH', { active: false });
    expect(deactivate.status).toBe(200);
    const login = await loginAs(baseUrl, attendant.email).catch(() => null);
    expect(login).toBeNull();
  });
});

describe('consulta de auditoria (e2e)', () => {
  it('admin consulta com filtro; gerente recebe 403', async () => {
    await seedUser(prisma, 'admin');
    await seedUser(prisma, 'manager');
    const adminToken = await loginAs(baseUrl, 'admin@teste.local');
    const managerToken = await loginAs(baseUrl, 'manager@teste.local');

    // Gera dois registros de tipos distintos:
    await api('/users', adminToken, 'POST', {
      name: 'X',
      email: 'x@teste.local',
      password: 'senha-forte-8+',
      role: 'attendant',
    });
    await api('/store/regions', managerToken, 'POST', { name: 'Centro', feeCents: 500 });

    expect((await api('/audit', managerToken)).status).toBe(403);

    const all = (await (await api('/audit', adminToken)).json()) as Array<{ action: string }>;
    expect(all.length).toBe(2);

    const filtered = (await (
      await api('/audit?entity=DeliveryRegion', adminToken)
    ).json()) as Array<{ action: string }>;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].action).toBe('region.created');
  });
});
