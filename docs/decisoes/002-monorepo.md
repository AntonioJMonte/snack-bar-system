# DECISÃO #2 — Monorepo ou repositórios separados

**Data:** 2026-08-29 (sessão 01)

**Contexto:** define onde vivem backend, frontend e (na Fase 2) o agente; afeta CI,
compartilhamento de tipos e o fluxo de PR desde o primeiro commit.

## Opção A — Monorepo com npm workspaces (`apps/api`, `apps/web`, futuro `apps/agente`)
- Prós: tipos e contratos compartilhados sem publicar pacote; um clone, um CI, uma PR
  por mudança que cruza API e site; ideal para desenvolvedor único; o agente da Fase 2
  entra como workspace novo sem tocar no resto.
- Contras: configuração inicial um pouco maior; deploys exigem apontar para subpastas.

## Opção B — Repositórios separados
- Prós: deploy independente; isolamento máximo.
- Contras: contrato da API duplicado ou publicado como pacote; três CIs; PRs
  coordenadas — atrito alto para uma pessoa só.

**Recomendação:** A.
**Custo de reverter:** médio — extrair pasta para repo próprio preserva histórico com
`git filter-repo`, mas exige refazer CI e deploy.

## Resposta do usuário
> "Decisão 2 [...] segue a opção A"

**Resultado:** monorepo com npm workspaces.
