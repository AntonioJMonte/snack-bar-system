# DECISÃO #11 — Estratégia de banco nos testes e2e

**Data:** 2026-08-29 (sessão 01)
Corresponde ao item 10 da lista da Etapa 2 do prompt.

**Contexto:** e2e aplicam migrações e exercitam a API por HTTP contra Postgres real.

## Opção A — Banco recriado por execução + TRUNCATE entre testes
No início da suíte, recria `lanchonete_test` e aplica migrações; entre cada teste,
trunca as tabelas.
- Prós: schema limpo garantido a cada execução (valida migrações de graça); truncate é
  rápido; compatível com transações reais da aplicação e com teste via HTTP.
- Contras: suíte não paralelizável contra o mesmo banco (aceitável nesta fase).

## Opção B — Transação revertida por teste
- Prós: isolamento máximo.
- Contras: incompatível com criação de pedido que abre a própria transação e com
  exercício da API por HTTP (conexões diferentes).

**Recomendação:** A.
**Custo de reverter:** baixo — infraestrutura de teste, sem tocar produção.

## Resposta do usuário
> "Opção A para todas as decisões"

**Resultado:** banco de teste recriado por execução, TRUNCATE entre testes.
