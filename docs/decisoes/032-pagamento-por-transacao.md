# DECISÃO #32 — Pagamento duplicado no mesmo pedido

**Data:** 2026-09-02 (sessão 07)

**Contexto:** o modelo tinha `Payment.orderId` com restrição `@unique` — um pagamento
por pedido. O `upsert` compilava para `INSERT ... ON CONFLICT ("order_id") DO UPDATE`,
então uma segunda transação do gateway **sobrescrevia** a linha da primeira.

Investigação da sessão 07 (executada ponta a ponta, não deduzida) mostrou duas perdas
distintas no cenário "cartão recusado → Pix aprovado → cartão aprovado com atraso":

1. A linha de `tx-card-1` (recusado) era substituída pela de `tx-pix-2`. O id da
   tentativa recusada desaparecia do banco.
2. O terceiro pagamento, **aprovado**, era descartado em silêncio (`already_processed`,
   indistinguível de webhook duplicado legítimo). O cliente foi cobrado duas vezes, o
   extrato do Mercado Pago tem duas entradas, o banco tem uma, e nada em lugar nenhum
   indicava que existia um estorno a fazer.

## Opção A — Uma linha por transação do gateway

Remover o `@unique` de `order_id`; a unicidade que resta é `gateway_transaction_id`.

- Prós: nada se perde; a tabela bate 1:1 com o extrato do Mercado Pago, que é como o
  dono confere o caixa; o estorno passa a ter onde ser registrado.
- Contras: migração muda unicidade; 4 pontos de leitura mudam, sendo um a tela do
  admin (`order.payment` vira lista).

## Opção B — Uma linha por pedido, excedente numa tabela de incidentes

- Prós: não mexe na unicidade nem em quem lê.
- Contras: duas tabelas contando a mesma história; "quanto entrou neste pedido?" exige
  olhar em dois lugares. Não resolve o estorno.

## Opção C — Manter e só registrar `logger.error`

- Prós: custo quase zero.
- Contras: log de aplicação não é interface — numa lanchonete ninguém abre log.
  Continua sendo falha silenciosa, só documentada.

**Recomendação:** A. O modelo afirmava algo falso ("um pedido tem um pagamento") e a
realidade do gateway não obedece. B constrói uma segunda tabela para abrigar a exceção
de um modelo errado.

**Custo de reverter:** médio — voltar ao `@unique` exigiria limpeza manual de pedidos
com mais de uma linha.

## Resposta do usuário

> "Para decisão 1, o ponto A."

**Resultado:**

- Migração `20260902210000_pagamento_por_transacao_idempotencia_expiracao` derruba
  `payments_order_id_key` e cria o índice não único `payments_order_id_idx`.
- `PaymentsService` grava com `create`, não mais `upsert`. Segundo pagamento aprovado
  no mesmo pedido é registrado e devolve o desfecho `duplicate_payment`, com
  `logger.error`.
- `GET /orders` passa a devolver `payments: []` (lista) no lugar de `payment`; a tela
  `/admin/pedidos` lista todas as transações e exibe **PAGO DUAS VEZES — conferir e
  estornar no Mercado Pago** quando há mais de uma aprovada.
- Achado adjacente corrigido junto: o estorno chega no **mesmo** id do pagamento
  aprovado, e o curto-circuito de idempotência o engolia — o ramo de estorno era
  inalcançável e **nenhum estorno era registrado**. Agora a mesma transação com status
  novo atualiza a linha.
