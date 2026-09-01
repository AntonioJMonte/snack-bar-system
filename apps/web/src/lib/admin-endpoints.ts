'use client';

import {
  adminCatalogSchema,
  adminItemSchema,
  auditLogsSchema,
  deliveryRegionSchema,
  orderHistorySchema,
  storeScheduleSchema,
  storeStatusSchema,
  userSchema,
  usersSchema,
  type CreateUserRequest,
  type OrderStatus,
  type Role,
} from '@lanchonete/contracts';
import { z } from 'zod';
import { auditRoute, menuRoute, orderRoute, storeRoute, userRoute } from '@/routes';
import { apiRequest } from './api';
import { readToken } from './auth';

// Chamadas do PAINEL ADMINISTRATIVO. URLs e métodos vêm do catálogo em
// `src/routes/` (decisão #29). Toda rota daqui é protegida no servidor por
// perfil (seção 12.2): esconder um botão na interface nunca é controle de acesso.

const overrideResponseSchema = z.object({ id: z.uuid(), open: z.boolean() }).loose();
const createdIdSchema = z.object({ id: z.uuid() }).loose();
// As rotas de item devolvem a linha atualizada; a tela recarrega o catálogo, então
// basta confirmar que a resposta tem o formato de um item.
const itemRowSchema = adminItemSchema.partial().loose();

// ——— Cardápio ———

export function fetchCatalog() {
  return apiRequest(menuRoute.catalog.url(), adminCatalogSchema, {
    method: menuRoute.catalog.method,
    cache: 'no-store',
    token: readToken(),
  });
}

export function updateItemPrice(itemId: string, priceCents: number) {
  return apiRequest(menuRoute.updatePrice.url(itemId), itemRowSchema, {
    method: menuRoute.updatePrice.method,
    body: { priceCents },
    token: readToken(),
  });
}

export function updateItemDiscount(itemId: string, discountPercent: number) {
  return apiRequest(menuRoute.updateDiscount.url(itemId), itemRowSchema, {
    method: menuRoute.updateDiscount.method,
    body: { discountPercent },
    token: readToken(),
  });
}

export function setItemSoldOut(itemId: string, soldOut: boolean) {
  return apiRequest(menuRoute.setSoldOut.url(itemId), itemRowSchema, {
    method: menuRoute.setSoldOut.method,
    body: { soldOut },
    token: readToken(),
  });
}

export function setItemActive(itemId: string, active: boolean) {
  return apiRequest(menuRoute.updateItem.url(itemId), itemRowSchema, {
    method: menuRoute.updateItem.method,
    body: { active },
    token: readToken(),
  });
}

export interface CreateItemInput {
  name: string;
  description?: string;
  priceCents: number;
  discountPercent: number;
  photoUrl?: string;
  categoryId: string;
}

export function createItem(input: CreateItemInput) {
  return apiRequest(menuRoute.createItem.url(), itemRowSchema, {
    method: menuRoute.createItem.method,
    body: input,
    token: readToken(),
  });
}

export function createCategory(name: string, displayOrder: number) {
  return apiRequest(menuRoute.createCategory.url(), createdIdSchema, {
    method: menuRoute.createCategory.method,
    body: { name, displayOrder },
    token: readToken(),
  });
}

export function createAddon(itemId: string, name: string, priceCents: number) {
  return apiRequest(menuRoute.createAddon.url(itemId), createdIdSchema, {
    method: menuRoute.createAddon.method,
    body: { name, priceCents },
    token: readToken(),
  });
}

export function updateAddon(
  addonId: string,
  data: { name?: string; priceCents?: number; active?: boolean },
) {
  return apiRequest(menuRoute.updateAddon.url(addonId), createdIdSchema, {
    method: menuRoute.updateAddon.method,
    body: data,
    token: readToken(),
  });
}

// ——— Estado e configurações da loja ———

export function fetchStoreStatusAuth() {
  return apiRequest(storeRoute.status.url(), storeStatusSchema, {
    method: storeRoute.status.method,
    cache: 'no-store',
  });
}

export function setStoreOverride(open: boolean) {
  return apiRequest(storeRoute.override.url(), overrideResponseSchema, {
    method: storeRoute.override.method,
    body: { open },
    token: readToken(),
  });
}

export function fetchSchedules() {
  return apiRequest(storeRoute.listSchedules.url(), z.array(storeScheduleSchema), {
    method: storeRoute.listSchedules.method,
    cache: 'no-store',
  });
}

export interface ScheduleInput {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
}

export function replaceSchedules(schedules: ScheduleInput[]) {
  return apiRequest(storeRoute.replaceSchedules.url(), z.array(storeScheduleSchema), {
    method: storeRoute.replaceSchedules.method,
    body: { schedules },
    token: readToken(),
  });
}

export function fetchRegions() {
  return apiRequest(storeRoute.listRegions.url(), z.array(deliveryRegionSchema), {
    method: storeRoute.listRegions.method,
    cache: 'no-store',
  });
}

export function createRegion(name: string, feeCents: number) {
  return apiRequest(storeRoute.createRegion.url(), deliveryRegionSchema, {
    method: storeRoute.createRegion.method,
    body: { name, feeCents },
    token: readToken(),
  });
}

export function updateRegion(
  regionId: string,
  data: { name?: string; feeCents?: number; active?: boolean },
) {
  return apiRequest(storeRoute.updateRegion.url(regionId), deliveryRegionSchema, {
    method: storeRoute.updateRegion.method,
    body: data,
    token: readToken(),
  });
}

// ——— Pedidos ———

export function fetchOrderHistory(status?: OrderStatus, limit = 50) {
  return apiRequest(orderRoute.history.url({ status, limit }), orderHistorySchema, {
    method: orderRoute.history.method,
    cache: 'no-store',
    token: readToken(),
  });
}

// ——— Usuários e auditoria ———

export function fetchUsers() {
  return apiRequest(userRoute.list.url(), usersSchema, {
    method: userRoute.list.method,
    cache: 'no-store',
    token: readToken(),
  });
}

export function createUser(input: CreateUserRequest) {
  return apiRequest(userRoute.create.url(), userSchema, {
    method: userRoute.create.method,
    body: input,
    token: readToken(),
  });
}

export function updateUser(
  userId: string,
  data: { name?: string; role?: Role; active?: boolean },
) {
  return apiRequest(userRoute.update.url(userId), userSchema, {
    method: userRoute.update.method,
    body: data,
    token: readToken(),
  });
}

export function fetchAuditLogs(limit = 100) {
  return apiRequest(auditRoute.list.url({ limit }), auditLogsSchema, {
    method: auditRoute.list.method,
    cache: 'no-store',
    token: readToken(),
  });
}
