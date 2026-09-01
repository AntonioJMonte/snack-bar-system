# DECISÃO #30 — O catálogo de rotas vale para qual lado

**Data:** 2026-09-01 (sessão 05)

**Contexto:** decidido criar o catálogo de rotas (decisão #29), restava definir se
ele cobre só o site ou também a API.

## Opção A — Só o site
- Prós: é onde falta separação. Na API, cada controller já é o arquivo de rotas de
  um domínio (`auth.controller.ts`, `menu.controller.ts`, …), separado por caso de
  uso desde a sessão 01.
- Contras: os caminhos passam a existir declarados em dois lugares (o decorador do
  Nest e o catálogo do site), com risco de divergirem.

## Opção B — Site e API
Criar `routes/` também no backend, com os nove controllers importando os caminhos.
- Prós: uma origem única para o caminho de cada rota.
- Contras: no NestJS o caminho vive no decorador, colado ao handler que o atende;
  extrair para outro arquivo afasta a rota do código que responde por ela e briga
  com a convenção do framework. Mexeria em nove controllers e nos testes e2e.

**Recomendação:** A.
**Custo de reverter:** baixo no site, médio na API.

## Resposta do usuário
O usuário respondeu explicitamente a decisão #29 e não objetou ao escopo; seguiu-se
a recomendação A. **Confirmar se quiser espelhar na API.**

**Resultado:** catálogo só em `apps/web/src/routes/`. O risco de divergência entre o
decorador do Nest e o catálogo do site é mitigado por `routes.spec.ts` (formato das
URLs, ausência de duplicatas e de parâmetro por interpolar) e pelos 55 testes e2e da
API, que exercitam os caminhos reais. Não há, hoje, teste que compare
automaticamente as duas listas — se essa divergência aparecer na prática, vale criar.
