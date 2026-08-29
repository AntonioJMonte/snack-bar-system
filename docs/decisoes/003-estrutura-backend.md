# DECISÃO #3 — Estrutura de pastas do backend

**Data:** 2026-08-29 (sessão 01)

**Contexto:** determina como a regra da seção 13 (nenhum canal conhece saída) aparece
fisicamente no código.

## Opção A — Por módulo de domínio
(`cardapio/`, `pedidos/`, `pagamentos/`, `loja/`, `usuarios/`, `auditoria/`,
`painel/`), cada um com seus controllers/services/schemas dentro.
- Prós: idioma natural do NestJS (um `Module` por domínio); a fronteira da seção 13
  vira fronteira de import visível; a Fase 2 entra como módulo novo assinando o evento
  de pedido pago.
- Contras: exige disciplina contra dependência circular entre módulos.

## Opção B — Por camada técnica (`controllers/`, `services/`, `repositories/` globais)
- Prós: familiar de MVC clássico; menos pastas no início.
- Contras: a fronteira entre domínios fica invisível; contraria a estrutura de módulos
  do NestJS.

**Recomendação:** A.
**Custo de reverter:** médio — reorganização mecânica, mas desfaz história de review.

## Resposta do usuário
> "Decisão [...] 3 segue a opção A"

**Resultado:** estrutura por módulo de domínio. Nomes das pastas seguem a decisão #4
(identificadores em inglês): `menu/`, `orders/`, `payments/`, `store/`, `users/`,
`audit/`, `panel/`.
