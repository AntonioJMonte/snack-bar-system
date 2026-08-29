# DECISÃO #10 — Layout do Docker Compose para Postgres local

**Data:** 2026-08-29 (sessão 01)
Corresponde ao item 9 da lista da Etapa 2 do prompt.

**Contexto:** Postgres local em Docker é mandatório pelas restrições da sessão; resta
decidir como separar desenvolvimento de teste.

## Opção A — Um container Postgres 17 com dois bancos (`lanchonete_dev`, `lanchonete_test`)
- Prós: um serviço só; isolamento por banco suficiente; menos RAM; portas simples.
- Contras: dev e test na mesma instância (mitigado por nomes explícitos na URL).

## Opção B — Dois containers separados
- Prós: isolamento físico total.
- Contras: dois serviços; mais uma porta/variável para errar.

**Recomendação:** A.
**Custo de reverter:** baixo — editar docker-compose.yml.

## Resposta do usuário
> "Opção A para todas as decisões"

**Resultado:** um container `postgres:17` com bancos `lanchonete_dev` e
`lanchonete_test` criados por script de init.
