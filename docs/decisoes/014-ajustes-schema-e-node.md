# DECISÃO #14 — Ajustes de schema e versão de Node local

**Data:** 2026-08-29 (sessão 01)

**Contexto:** quatro pontos levantados na apresentação do schema (Etapa 3), antes da
migração inicial.

1. **Node local 25 vs 24 LTS:** máquina tem 25.1.0; decisão #5 fixou 24 LTS.
   Aprovado (a): desenvolvimento local com Node 25 e `engines >=24`; produção em 24 LTS.
2. **Status inicial do pedido:** `pending_payment` acrescentado ao enum (o PDF lista
   estados a partir de `aguardando_aceite`, mas o pedido existe antes do pagamento;
   "recusado" é estado do Payment). Confirmado.
3. **Adicional "vínculo com item ou grupo":** "grupo" não é definido no PDF. Adicional
   ligado direto ao Item; grupos só quando houver caso real. Confirmado.
4. **Endereço:** texto livre + FK para `DeliveryRegion` (região determina a taxa), sem
   campos estruturados. Confirmado.

Aprovada também a lista de dependências (NestJS 11, event-emitter, zod, Prisma 6,
Vitest + SWC, sem supertest — e2e com fetch nativo).

## Resposta do usuário
> "Para o ponto 1 vamos seguir a decisão a. Confirmo os demais pontos. Pode instalar tudo"
