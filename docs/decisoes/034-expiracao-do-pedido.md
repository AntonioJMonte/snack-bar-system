# DECISÃO #34 — Janela de expiração e pagamento tardio

**Data:** 2026-09-02 (sessão 07)

**Contexto:** `reconcilePendingOrders` buscava 50 pedidos `pending_payment` por ciclo,
do mais antigo para o mais novo, **sem limite superior de idade**. Pedido abandonado
(cliente abre o checkout e fecha a aba) nunca saía dessa consulta. Depois de algumas
semanas os 50 slots estariam ocupados por pedidos zumbis e a reconciliação deixaria de
examinar os pedidos novos — a partir daí, um webhook perdido não seria recuperado por
ninguém: o cliente paga e o pedido nunca confirma. Degradação silenciosa: nada quebra,
só para de funcionar.

## 34a — Quanto tempo em `pending_payment`

Proposta apresentada: 60 minutos, pelo risco assimétrico (expirar cedo demais mata
venda; expirar tarde demais só ocupa slot).

### Resposta do usuário

> "Para a decisão 2a coloque um tempo de 15min, dificilmente alguém esquece de pagar
> por tanto tempo, além disso ao expirar o tempo o pagamento é automaticamente
> cancelado, sendo necessário gerar um novo qr code. Caso ele pague por exemplo em
> 14min e o pagamento só seja confirmado 2 min dps (1 min após o qr code expirar)
> adicionamos uma tolerância de 10 min. Totalizando um total de 15 min de qr code ativo
> e 10 min de tempo extra para processamento de pagamento (sem o qr code na tela)."

**Resultado:** `src/common/order-expiry.ts` — `CHECKOUT_QR_MINUTES = 15`,
`PAYMENT_GRACE_MINUTES = 10`, `ORDER_EXPIRY_MINUTES = 25`. Um número só, usado pela
expiração **e** pela reconciliação, para que as duas não possam discordar sobre o que é
um pedido vivo.

- Novo valor `expired` no enum `OrderStatus` (terminal — não avança por transição).
- `OrdersService.expireAbandonedOrders()` marca `expired` + `expiredAt`, chamada pelo
  scheduler a cada 60s **antes** da reconciliação.
- `reconcilePendingOrders` ganha piso de idade (`createdAt >= agora − 25 min`): o filtro
  por status já exclui expirados, e a data é a segunda barreira para o caso de a
  expiração ainda não ter rodado.
- Pedido `expired` não aceita novo checkout (`ORDER_NOT_PAYABLE`): precisa de pedido
  novo, como o QR cancelado exige.

**Pendência de verificação:** o `createCheckout` **não envia** expiração ao gateway
(`expires` / `date_of_expiration` não são preenchidos em `gateway.ts`), então hoje vale
o padrão do Mercado Pago. Os 15 minutos são a regra do NOSSO lado. Confirmar o prazo
real do QR no sandbox e, se divergir, alinhar o gateway a este número — está na lista
que bloqueia o deploy.

## 34b — Pagamento que chega depois da expiração

**Opção A — Ressuscita com marca visível.** `expired` → `awaiting_acceptance`, com faixa
destacada no painel.

- Prós: cobre o caso real e frequente — quem pagou pouco depois do prazo está no balcão
  esperando. Fluxo de sempre, com uma informação a mais. Nenhuma tela nova.
- Contras: o alerta soa igual ao de um pedido novo; a distinção depende de ler a faixa.

**Opção B — Não ressuscita.** Fica `expired`, pagamento gravado, seção "pagamentos a
resolver" no admin; para produzir, o gerente reabre à mão.

- Prós: impossível confundir com pedido novo.
- Contras: cria um fluxo exercitado raríssimas vezes — e fluxo raro é fluxo que ninguém
  lembra como usar na hora do aperto.

**Opção C — Tolerância** (ressuscita até X min depois; além disso vira B).

- Contras: mais um número arbitrário e dois caminhos para manter.

**Recomendação:** A. A trava contra produzir pedido velho já existe e é o **aceite
humano** — nada entra em produção sozinho. O que faltava era a pessoa saber.

**Custo de reverter:** baixo.

### Resposta do usuário

> "Para o 2b vamos seguir com o ponto A."

**Resultado:** `Order.paidAfterExpiryAt` é carimbado quando um pagamento aprovado chega
para um pedido `expired`; o pedido volta para `awaiting_acceptance` e o cartão do painel
exibe **PAGAMENTO FORA DO PRAZO — confirme com o cliente antes de aceitar**. Um
`logger.warn` registra `payment.paid_after_expiry`.
