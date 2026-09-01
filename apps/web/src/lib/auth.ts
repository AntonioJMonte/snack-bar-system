'use client';

import { jwtPayloadSchema, type JwtPayload, type Role } from '@lanchonete/contracts';

// Token em localStorage + header Authorization (decisão #25). O que este arquivo
// lê do JWT serve APENAS para a interface (mostrar o nome, esconder botões que o
// usuário não pode usar). A autorização de verdade é sempre verificada no
// servidor, em toda rota (seção 12.2) — um atendente que chame a API direto
// continua sendo rejeitado lá.

const TOKEN_KEY = 'lanchonete.panel.token';

export function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Navegador com armazenamento bloqueado: a sessão vale só para esta aba.
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nada a fazer.
  }
}

// Decodifica o payload SEM verificar assinatura — verificar é papel do servidor.
function decodeJwt(token: string): JwtPayload | null {
  const segments = token.split('.');
  if (segments.length !== 3) return null;
  try {
    const json = atob(segments[1].replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = jwtPayloadSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export interface PanelSessionUser {
  id: string;
  name: string;
  role: Role;
}

export function currentUser(): PanelSessionUser | null {
  const token = readToken();
  if (!token) return null;
  const payload = decodeJwt(token);
  if (!payload) return null;
  // Token expirado é o mesmo que ausente: manda para o login em vez de deixar a
  // tela quebrar em 401 a cada polling.
  if (payload.exp && payload.exp * 1000 <= Date.now()) return null;
  return { id: payload.sub, name: payload.name, role: payload.role };
}

// Hierarquia atendente < gerente < admin (decisão #17).
const RANK: Record<Role, number> = { attendant: 1, manager: 2, admin: 3 };

export function hasAtLeast(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}
