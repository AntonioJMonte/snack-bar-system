# DECISÃO #33 — Deduplicação do "finalizar pedido"

**Data:** 2026-09-02 (sessão 07)

**Contexto:** cliente com internet instável clica "finalizar pedido", não vê resposta e
clica de novo. Cada clique criava um pedido novo — três cliques, três pedidos, três
cobranças possíveis e confusão na cozinha. Nada impedia isso.

Pré-aprovado no briefing da sessão 07 (Bloco B), sem opções alternativas.

**Resultado:**

- `Order.idempotencyKey String? @unique`. O UNIQUE do Postgres aceita múltiplos NULL,
  então canal que não manda chave continua funcionando — compatibilidade preservada.
- `POST /orders` lê o cabeçalho `Idempotency-Key` (até 100 caracteres). Chave já
  existente devolve o pedido existente com **200**; chave nova cria e responde **201**.
- `P2002` é tratado como caminho **normal**, não erro: houve corrida entre dois
  cliques, busca-se o pedido pela chave e devolve-se ele.
- No navegador a chave vive no store do carrinho (`checkoutKey`), **persistida em
  localStorage junto com o carrinho** — o cenário que ela resolve é o do celular que
  recarrega a página no meio da tentativa. Zera a cada mudança do carrinho e ao
  concluir o pedido: carrinho diferente é pedido diferente.
- `POST /payments/checkout/:orderId` guarda `Order.checkoutInitPoint` e devolve a mesma
  preferência em vez de criar outra no Mercado Pago a cada clique. A chamada ao gateway
  é I/O e não pode ficar dentro de transação, então a persistência usa `updateMany`
  condicionado a NULL: em dois cliques simultâneos só o primeiro grava e ambos devolvem
  a mesma URL.

Coberto por `apps/api/test/idempotency.e2e-spec.ts`, incluindo três `POST /orders`
**simultâneos** com a mesma chave: um 201, dois 200, um único pedido no banco.
