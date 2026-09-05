# DECISÃO #37 — Expiração do Pix, o piso do gateway e o descarte do sandbox

**Data:** 2026-09-05 (sessão 08)

## Parte 1 — O sandbox foi descartado (registro, não decisão)

A sessão 07 terminou com um único item bloqueando a Fase 1A: *"testar contra o sandbox
do Mercado Pago"*. **Esse item está encerrado, e não porque foi feito.**

A central de ajuda do Mercado Pago documenta que **não é possível pagar com Pix em
ambiente de teste**, porque não se cadastra chave Pix em usuário de teste. O sandbox
nunca poderia validar o fluxo que importa — o Pix é o meio de pagamento principal do
PDF (10.3) e o único que a frase-teste da seção 2.2 exercita de ponta a ponta.

**Registro explícito para quem ler isto depois: o sandbox não foi pulado por pressa,
por descuido nem por falha nossa.** Foi descartado por limitação documentada do
gateway. A alternativa escolhida é o teste em **produção com valor mínimo**, com contas
reais. Toda a robustez construída nas sessões 06 e 07 (idempotência, transação por
pedido, 5xx no `lock_timeout`, reconciliação, expiração) existe justamente para que o
primeiro pagamento real não seja um salto no escuro.

O que se perde com isso e precisa ser compensado por atenção humana: o primeiro
pagamento real é também o primeiro teste da assinatura do webhook. O log adicionado
nesta sessão (`payment.invalid_webhook_signature`, sessão 08 bloco A3) existe
exatamente para esse momento — ver "Consequência operacional" na parte 3.

---

## Parte 2 — Expiração do Pix

### Contexto

`ORDER_EXPIRY_MINUTES` era **25** (15 de QR + 10 de folga), número escolhido pelo
usuário na decisão #34. Ao mesmo tempo, `createCheckout` **não enviava expiração alguma
ao gateway**, então valia o padrão do Mercado Pago — 24 horas.

O resultado era uma inversão: **o QR sempre sobrevivia ao pedido.** Um cliente que
pagasse no minuto 40 estaria usando um QR perfeitamente válido para um pedido que já
morreu. O caminho de `paidAfterExpiryAt` da decisão #34 — desenhado para a borda
"pagou no minuto 14, confirmou no 16" — viraria **rotina**. E faixa que aparece toda
hora é faixa que ninguém lê: a proteção pararia de proteger exatamente no dia em que
importasse. No pior caso, um pedido ressuscitaria no painel da loja **no dia seguinte**.

Duas correções factuais que mudaram o enunciado original do problema:

**a) O campo é `date_of_expiration`, não `expiration_date_to`.** Confirmado nos tipos do
SDK instalado (`mercadopago/dist/clients/preference/commonTypes.d.ts`):

- `date_of_expiration` — *"ISO 8601 expiration date after which the preference cannot be
  paid"*. É o vencimento do Pix.
- `expiration_date_from` / `expiration_date_to` (+ `expires: true`) — *"ISO 8601 start /
  end of the preference activation window"*. É a janela de ativação da preferência,
  coisa diferente.

Fixar o campo errado não teria efeito nenhum sobre o QR, **e o sintoma seria silencioso**.

**b) O piso de 30 minutos é premissa, não fato verificado por mim.** As páginas de
*expiration date* do Checkout Pro que consegui abrir não documentam mínimo nem padrão
para Pix — só recomendam "no mínimo 3 dias", que é orientação de boleto. Fonte apontada
pelo usuário, a confirmar no primeiro pagamento real:

> https://www.mercadopago.com.br/developers/es/docs/checkout-api-orders/payment-integration/pix

### Opções apresentadas

**Opção A — Subir nosso prazo até o piso e fixar a expiração na preferência.**
- Prós: restaura a ordem que a #34 desenhou — QR morre primeiro, pedido depois.
  `paidAfterExpiryAt` volta a ser borda e a faixa volta a significar alguma coisa. O
  prazo passa a ser nosso, escrito no código, em vez do padrão do gateway.
- Contras: muda o 15 escolhido pelo usuário na #34. Pedido não pago ocupa slot da
  reconciliação por mais tempo (irrelevante: são 50 slots).
- Custo de reverter: **baixo** — duas constantes e um campo.

**Opção B — Manter 25 e não mandar nada (status quo).**
- Prós: zero código.
- Contras: mantém a inversão em escala de 24 horas. Custo baixo em código, **alto em
  operação**: o dano é confusão no balcão.
- Custo de reverter: baixo.

**Opção C — Manter os 25 nossos, mas fixar `date_of_expiration` no piso de 30.**
- Prós: corta o pior caso de 24h para 30 min sem mexer no número aprovado.
- Contras: mantém a inversão, só que menor — sobra uma janela de 5 min em que a faixa é
  rotina. Meia correção, com o mesmo defeito da B em escala menor.
- Custo de reverter: baixo.

**Opção D — Prazo folgado: 60 de QR + 10 de folga = 70.**
- Prós: nunca esbarra em piso nenhum.
- Contras: contraria o raciocínio do usuário na #34 ("dificilmente alguém esquece de
  pagar por tanto tempo"); a loja fica quase uma hora vendo "aguardando pagamento" de
  gente que desistiu.
- Custo de reverter: baixo.

**Recomendação apresentada:** A. É a única que restaura a premissa da #34 em vez de
conviver com a inversão. A C é a A com medo de mexer no 15 — e o 15 já não é alcançável
se o piso for 30.

### Resposta do usuário

> "C1 — DECIDIDO: Opção A com margem. `date_of_expiration = order.createdAt + 40min`.
> `CHECKOUT_QR_MINUTES` 15 → 40, folga 10, `ORDER_EXPIRY_MINUTES` 25 → 50. Motivo dos 40
> em vez de 30: a doc do MP conta o piso 'a partir da criação do PAGAMENTO', que no
> Checkout Pro nasce depois do pedido — os 10 min extras cobrem essa diferença."

**Opção A, com margem de 10 minutos sobre o piso.** O raciocínio da margem é o que a
recomendação original não tinha visto: as duas âncoras são diferentes. Nosso relógio
começa a contar na criação do **pedido**; o piso do gateway conta da criação do
**pagamento**, que no Checkout Pro nasce depois. Ancorar em 30 deixaria o prazo efetivo
abaixo do piso sempre que houvesse qualquer atraso entre uma coisa e outra.

---

## Parte 3 — O que foi implementado

`src/common/order-expiry.ts`:

```
CHECKOUT_QR_MINUTES  = 40   (era 15)
PAYMENT_GRACE_MINUTES = 10  (inalterado)
ORDER_EXPIRY_MINUTES  = 50  (era 25)
```

Continua sendo **um número só**, agora governando três coisas que não podem discordar:
a expiração do pedido (`expireAbandonedOrders`), o piso de idade da reconciliação
(`reconcilePendingOrders`) e o prazo enviado ao gateway.

`src/payments/gateway.ts` — a preferência passa a levar:

```ts
date_of_expiration: new Date(
  input.orderCreatedAt.getTime() + CHECKOUT_QR_MINUTES * 60 * 1000,
).toISOString(),
```

**A âncora é o `createdAt` do PEDIDO, não o instante da chamada.** A preferência é
reaproveitada (decisão #33), e ancorar em "agora" faria o QR nascer com prazo cheio a
partir de um pedido já velho — exatamente a inversão que esta decisão elimina.
`CheckoutPreferenceInput` ganhou `orderCreatedAt` para isso.

### Consequência operacional — o que conferir no primeiro pagamento real

1. **O vencimento que o QR realmente exibe.** É a confirmação da premissa do piso. Se o
   Mercado Pago recusar `date_of_expiration` ou ajustá-lo, aparece aqui.
2. **Se o pagamento fora do prazo continua sendo borda.** A faixa "PAGAMENTO FORA DO
   PRAZO" não deve aparecer num pagamento normal. Se aparecer, a inversão não foi
   resolvida.

### Risco residual aceito

Se o piso do gateway for contado como "30 minutos a partir de agora" e não como "janela
de 30 minutos", `createdAt + 40` pode ser recusado quando houver atraso grande entre a
criação do pedido e a do checkout. Na prática o checkout é pedido segundos depois do
pedido, e a preferência só é criada uma vez — mas isso sai no primeiro teste real, não
antes.

### Cobertura de teste — e o que ela NÃO cobre

Coberto (`test/payments.e2e-spec.ts`): o checkout entrega ao gateway o `createdAt` real
do pedido como âncora. É o elo que alguém quebraria em silêncio ao trocar por
`new Date()`.

**Não coberto:** a conversão para ISO e o envio do campo `date_of_expiration` em si. O
`MercadoPagoClient` é substituído por um fake nos e2e, então o corpo que chega ao SDK
não é exercitado. Cobrir exigiria mockar o SDK — máquina nova que a decisão #31 não
autoriza. **Verificação: manual, no primeiro pagamento real, pelo item 1 acima.**
