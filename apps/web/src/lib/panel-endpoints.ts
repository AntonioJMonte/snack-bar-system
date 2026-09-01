'use client';

import {
  loginResponseSchema,
  orderStatusSchema,
  panelOrdersSchema,
  panelSessionsSchema,
  type AdvanceStatusRequest,
} from '@lanchonete/contracts';
import { z } from 'zod';
import { authRoute, panelRoute } from '@/routes';
import { apiRequest } from './api';
import { readToken } from './auth';

// Chamadas do PAINEL. Módulo de SAÍDA: fala apenas com o backend, nunca com um
// canal de entrada (seção 13). URLs e métodos vêm do catálogo em `src/routes/`.

// Aceite e avanço de status devolvem a linha do pedido SEM os itens (o update do
// Prisma não faz include). A tela não usa esse retorno — ela recarrega a lista —
// então validamos só o que confirma que a operação surtiu efeito.
const orderRowSchema = z.object({ id: z.uuid(), status: orderStatusSchema }).loose();

const heartbeatResponseSchema = z.object({ id: z.string() }).loose();

export function login(email: string, password: string) {
  return apiRequest(authRoute.login.url(), loginResponseSchema, {
    method: authRoute.login.method,
    body: { email, password },
  });
}

export function fetchPanelOrders() {
  return apiRequest(panelRoute.listOrders.url(), panelOrdersSchema, {
    method: panelRoute.listOrders.method,
    cache: 'no-store',
    token: readToken(),
  });
}

export function acceptOrder(orderId: string) {
  return apiRequest(panelRoute.accept.url(orderId), orderRowSchema, {
    method: panelRoute.accept.method,
    token: readToken(),
  });
}

export function advanceOrderStatus(orderId: string, status: AdvanceStatusRequest['status']) {
  return apiRequest(panelRoute.advanceStatus.url(orderId), orderRowSchema, {
    method: panelRoute.advanceStatus.method,
    body: { status },
    token: readToken(),
  });
}

export function sendHeartbeat(device: string, soundArmed: boolean) {
  return apiRequest(panelRoute.heartbeat.url(), heartbeatResponseSchema, {
    method: panelRoute.heartbeat.method,
    body: { device, soundArmed },
    token: readToken(),
  });
}

export function fetchPanelSessions() {
  return apiRequest(panelRoute.listSessions.url(), panelSessionsSchema, {
    method: panelRoute.listSessions.method,
    cache: 'no-store',
    token: readToken(),
  });
}
