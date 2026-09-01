# DECISÃO #24 — Contrato entre web e API

**Data:** 2026-09-01 (sessão 04)

**Contexto:** o web precisa de tipos e validação para chamar a API. O backend já é
Zod-first (PDF 10.1), mas não expõe OpenAPI instrumentado.

## Opção A — Pacote compartilhado `packages/contracts`
Schemas Zod (requests e responses) usados pelos dois lados; cliente HTTP fino escrito
à mão no web.
- Prós: uma única fonte de tipos e validação em runtime nos dois lados; usa a
  estrutura `packages/*` já prevista no monorepo; sem toolchain nova.
- Contras: contrato mantido à mão — pode descolar da API se a disciplina falhar
  (mitigado pelos e2e, que exercitam os mesmos schemas).

## Opção B — Gerar cliente do OpenAPI
Instrumentar a API com Swagger e gerar tipos com openapi-typescript.
- Prós: contrato gerado do código, não desatualiza.
- Contras: a API valida com Zod e não tem decorators Swagger — seria preciso
  instrumentar tudo primeiro; toolchain extra; validação de runtime no web
  continuaria por conta própria.

**Recomendação:** A — aproveita o investimento Zod existente; OpenAPI pode entrar
depois como documentação sem mudar essa escolha.
**Custo de reverter:** baixo-médio — os schemas compartilhados continuariam úteis
mesmo migrando para geração.

## Resposta do usuário
> "A — Zod compartilhado"

**Resultado:** criado `packages/contracts` (`@lanchonete/contracts`). As funções puras
que definem regra de negócio única (arredondamento half-up de `pricing.ts` e
normalização de telefone de `phone.ts`) e o `createOrderSchema` MUDARAM para o pacote;
a API reexporta dos caminhos antigos (testes existentes continuam valendo). O web
valida as respostas da API em runtime com os schemas de resposta do pacote.
