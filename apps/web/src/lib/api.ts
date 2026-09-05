import { apiErrorSchema, type ApiError as ApiErrorBody } from '@lanchonete/contracts';
import type { z } from 'zod';

// Único ponto de contato do site com o backend. O site é um módulo de CANAL:
// não conhece painel nem impressão, só a API (seção 13).
//
// SEM valor padrão, de propósito. O `?? 'http://localhost:3001'` que existia
// aqui era falha silenciosa da pior espécie: o prefixo NEXT_PUBLIC_ faz o Next
// GRAVAR este valor dentro dos chunks do navegador durante o build, então
// esquecer a variável no provedor produzia um deploy verde que mandava o
// CELULAR DO CLIENTE falar com o próprio localhost. Nada quebrava; a loja
// simplesmente não vendia. Melhor não compilar.
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiUrl) {
  throw new Error(
    'NEXT_PUBLIC_API_URL não está definida. Ela é lida no BUILD (o prefixo ' +
      'NEXT_PUBLIC_ grava o valor nos chunks do navegador), não em runtime: ' +
      'defina-a antes de `next build`, tanto em desenvolvimento (apps/web/.env.local) ' +
      'quanto no provedor de hospedagem. Ex.: NEXT_PUBLIC_API_URL=http://localhost:3001',
  );
}
export const API_URL = apiUrl;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    readonly body: ApiErrorBody,
  ) {
    super(body.message ?? code ?? `Erro ${status}`);
    this.name = 'ApiError';
  }
}

// Erro de contrato: a API respondeu 2xx num formato que não reconhecemos.
// Falhar alto é melhor que renderizar dado inválido numa tela de dinheiro.
export class ContractError extends Error {
  constructor(path: string, readonly issues: z.ZodIssue[]) {
    super(`Resposta inesperada da API em ${path}`);
    this.name = 'ContractError';
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  token?: string | null;
  // Server Components: controla o cache do fetch do Next.
  revalidate?: number | false;
}

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const { body, token, revalidate, headers, ...init } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(revalidate !== undefined ? { next: { revalidate } } : {}),
  });

  if (!response.ok) {
    const raw: unknown = await response.json().catch(() => ({}));
    const parsed = apiErrorSchema.safeParse(raw);
    const errorBody: ApiErrorBody = parsed.success ? parsed.data : {};
    throw new ApiError(response.status, errorBody.code, errorBody);
  }

  const raw: unknown = await response.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ContractError(path, parsed.error.issues);
  }
  return parsed.data;
}
