# DECISÃO #5 — Versões fixadas de Node, NestJS, Prisma e PostgreSQL

**Data:** 2026-08-29 (sessão 01)

**Contexto:** fixa runtime e dependências principais para reprodutibilidade. Patches
exatos serão pinados no momento da instalação (Etapa 3) e anotados aqui.

## Opção A — Conservadora
Node 22 LTS (manutenção até abr/2027), NestJS 11, Prisma 6, PostgreSQL 16.
- Prós: máxima quilometragem e compatibilidade.
- Contras: janela de suporte menor do Node 22.

## Opção B — LTS atual
Node 24 LTS (suporte até 2028), NestJS 11, Prisma 6, PostgreSQL 17.
- Prós: mesma estabilidade, janela de suporte maior; PostgreSQL 17 é o padrão dos
  provedores gerenciados atuais.
- Contras: menos quilometragem acumulada.

**Recomendação:** B.
**Custo de reverter:** baixo — ajuste de config e reinstalação nesta fase.

## Resposta do usuário
> "Decisões 4 e 5 seguem as opções B"

**Resultado:** Node 24 LTS (produção; local roda 25.1 — decisão #14), NestJS 11.x,
Prisma 6.x, PostgreSQL 17.
Instalado na sessão 01: NestJS 11.2.3, Prisma 6.19.3, Zod 4.5.4, Vitest 4.1.11,
TypeScript 5.9.3, imagem `postgres:17`.
