import type { Role } from '@lanchonete/contracts';

// Catálogo de rotas: um arquivo por caso de uso, contendo APENAS a declaração de
// cada rota (método, URL e perfil exigido). A chamada em si — fetch, corpo,
// validação Zod — continua nos arquivos de endpoints em `lib/`.
//
// O objetivo é ter um lugar único onde se veem todas as rotas de um domínio.

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface Route<Params extends unknown[] = []> {
  readonly method: HttpMethod;
  /** Monta o caminho. Recebe os parâmetros de rota e/ou de query, quando houver. */
  readonly url: (...params: Params) => string;
  /**
   * Perfil mínimo exigido PELO SERVIDOR (seção 5.5). É documentação: quem decide
   * acesso é o guard da API, em toda requisição. `null` significa rota pública.
   * O front jamais usa este campo para liberar ou bloquear ação.
   */
  readonly minRole: Role | null;
}

export function route<Params extends unknown[]>(
  method: HttpMethod,
  url: (...params: Params) => string,
  minRole: Role | null,
): Route<Params> {
  return { method, url, minRole };
}
