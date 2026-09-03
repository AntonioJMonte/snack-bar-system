# Sessão 07 — Fechamento mínimo antes do sandbox do Mercado Pago

**Data:** 2026-09-02
**Objetivo:** resolver apenas o que evita perda de dinheiro, queda da aplicação ou
falha de segurança básica, para chegar ao teste com credenciais de sandbox. Escopo
definido na decisão #31.

---

## 1. Saída real dos testes

```
npm run typecheck                    exit=0  (api, web, contracts)

npm run test --workspaces
  apps/api          Test Files  9 passed (9)    Tests  73 passed (73)
  web + contracts   Test Files  5 passed (5)    Tests  51 passed (51)

npm run test:e2e -w apps/api
                    Test Files 10 passed (10)   Tests  71 passed (71)
```

**Total: 195 testes.** Antes da sessão eram 164 (70 + 55 + 39).

Arquivos e2e novos: `idempotency.e2e-spec.ts` (5) e `throttler.e2e-spec.ts` (3).
`payments.e2e-spec.ts` cresceu de 10 para 16 casos; `panel.e2e-spec.ts`, de 9 para 10.

---

## 2. Bloco A — as três verificações pendentes

### A1. O SQL real do `upsert`

Suíte rodada com `log_statement='all'` no servidor (revertido em seguida). O que o
Postgres recebeu:

```sql
execute s20: INSERT INTO "public"."payments" (...)
  VALUES (...)
ON CONFLICT ("order_id") DO UPDATE SET
  "method" = ..., "status" = ..., "gateway_transaction_id" = $11, "amount_cents" = $12,
  "updated_at" = $13
WHERE ("public"."payments"."order_id" = $14 AND 1=1)
RETURNING ...
```

**`INSERT ... ON CONFLICT DO UPDATE` nativo**, uma ida ao banco — não SELECT seguido de
INSERT. O alvo do conflito era **só `("order_id")`**: o índice único de
`gateway_transaction_id` não participava.

O mesmo log confirmou que a correção da sessão 06 é emitida de verdade:

```
execute s15: SET LOCAL lock_timeout = '3s'
execute s16: SELECT id FROM orders WHERE id = $1::uuid FOR UPDATE
```

### A2. `lock_timeout` devolvia 200 — corrigido para 503

Devolvia **200**, e portanto o Mercado Pago nunca reenviaria: a notificação se perdia.

**Isto foi erro meu, não desenho.** Na sessão 06 justifiquei o `lock_timeout` dizendo
que "o Mercado Pago reenvia o webhook" — falso com resposta 200. O estrago não era de
60 segundos: a reconciliação só enxerga pedidos com mais de 5 minutos, então a janela
real de recuperação chegava a ~6 minutos de alarme silencioso.

Verificado com uma segunda conexão segurando `FOR UPDATE` na linha do pedido:

```
[A2] webhook com a linha travada -> HTTP 503 apos 3054ms | body={"code":"PAYMENT_LOCK_TIMEOUT"}
[A2] nada persistido? linhas em payments=0 | status do pedido=pending_payment
```

Os 3054ms batem com o `lock_timeout` de 3s, e nada foi gravado — o 503 é honesto.

### A3. Dois `gatewayTransactionId` no mesmo pedido

Cenário executado ponta a ponta:

```
[1] cartao RECUSADO      tx-card-1 -> recorded          | [{tx-card-1, declined}]
[2] pix APROVADO         tx-pix-2  -> became_paid       | [{tx-pix-2, paid}]
    >>> tx-card-1 ainda existe no banco? false
[3] cartao APROVADO tardio tx-card-3 -> already_processed | [{tx-pix-2, paid}]
    >>> tx-card-3 existe no banco? false
    >>> total de linhas: 1  (dinheiro entrou 2x)
```

Duas perdas distintas: a tentativa recusada era **sobrescrita**, e o segundo pagamento
**aprovado** era descartado em silêncio. Resolvido pela decisão #32.

**Achado adjacente** encontrado na mesma investigação: o estorno chega no **mesmo** id
do pagamento aprovado, casava com o curto-circuito de idempotência e retornava antes do
ramo que o trataria. O ramo era inalcançável — **nenhum estorno era registrado**.
Corrigido junto, por ser a mesma peça de código.

---

## 3. O que foi implementado

| Bloco | Entrega |
|---|---|
| **B** | `Idempotency-Key` em `POST /orders` (200 para repetido, 201 para novo, `P2002` como caminho normal); chave gerada no navegador por checkout e persistida com o carrinho; `checkoutInitPoint` reaproveitado em vez de nova preferência no gateway. Decisão #33. |
| **C** | Throttler `default` de 120/min com sobrescrita por rota: webhook 600, pedido/checkout 60, painel 120, login 10. `TRUST_PROXY_HOPS`. `LoggingThrottlerGuard` registra todo bloqueio. Desligado em teste, com e2e dedicado que o religa. Decisão #35. |
| **D** | Status `expired`, `expireAbandonedOrders()` no scheduler antes da reconciliação, piso de idade na reconciliação, pagamento tardio ressuscita com `paidAfterExpiryAt` e faixa no painel. Decisão #34. |
| **E** | Timeout de 8s no SDK do Mercado Pago; falha na consulta vira 503; janela de frescor de 5 min na assinatura (com tolerância de 1 min de relógio); `mapMethod` avisa em vez de engolir. Decisão #36. |
| **F** | `helmet` com CORP `cross-origin`; limite de corpo explícito de 100kb; varredura de segredos; `ESTADO.md`; decisão #31. |
| **G** | `ci.yml` (typecheck + unitários + e2e com Postgres em service container + varredura de credencial) e `deploy.yml` só por `workflow_dispatch`, com publicação comentada. Badge no `README.md`. |

### Justificativa do F1 (CORP)

Passou de `same-origin` para `cross-origin`. O padrão do helmet é feito para quem serve
páginas e recursos; esta API devolve JSON para um site em outro domínio. Hoje o CORP não
bloquearia o `fetch()` (CORS já negocia isso), mas passaria a bloquear no dia em que a
API servir uma imagem do cardápio. O CORS continua sendo a barreira real: só
`WEB_ORIGIN` lê as respostas.

### F3 — segredos

Nenhum arquivo `.env` rastreado; `.gitignore` cobre `.env`, `.env.local` e `.env.*.local`;
`.env.example` contém apenas placeholders (`TEST-configure-sua-credencial`,
`troque-este-segredo-em-producao`). Busca por `APP_USR-`, `TEST-` seguido de dígitos e
`access_token` com valor literal: **nenhuma ocorrência** no que está versionado. O mesmo
teste virou passo do CI.

---

## 4. Tempo de resposta do webhook (E4)

30 chamadas contra o `FakeMercadoPago`, medidas pelo HTTP de ponta a ponta:

| Caso | min | p50 | máx | média |
|---|---|---|---|---|
| Confirma o pedido | 16ms | 21ms | 54ms | 23ms |
| Webhook duplicado | 10ms | 11ms | 18ms | 12ms |

Muito abaixo do teto de 5s — nenhuma decisão de otimização é necessária.

**Ressalva:** isto mede **o nosso código**. Contra o Mercado Pago real soma-se a
consulta ao gateway, limitada pelo timeout de 8s. Esse número só sai no sandbox.

---

## 5. Arquivos alterados

**Novos (13):**
`.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `README.md`,
`apps/api/prisma/migrations/20260902210000_pagamento_por_transacao_idempotencia_expiracao/`,
`apps/api/src/common/logging-throttler.guard.ts`, `apps/api/src/common/order-expiry.ts`,
`apps/api/test/idempotency.e2e-spec.ts`, `apps/api/test/throttler.e2e-spec.ts`,
`docs/decisoes/031` a `036`.

**Modificados (36):** `ESTADO.md`, `package.json`, `package-lock.json`,
`apps/api/.env.example`, `apps/api/package.json`, `apps/api/prisma/schema.prisma`,
`apps/api/scripts/simulate-payment.mjs`, `apps/api/src/{app.module,main}.ts`,
`apps/api/src/auth/auth.controller.ts`, `apps/api/src/config/env.ts`,
`apps/api/src/orders/{orders.controller,orders.service}.ts`,
`apps/api/src/panel/panel.controller.ts`,
`apps/api/src/payments/{gateway,payments.controller,payments.module,payments.scheduler,payments.service,webhook-signature,webhook-signature.spec}.ts`,
`apps/api/test/{admin-views,payments}.e2e-spec.ts`, `apps/api/test/seed.ts`,
`apps/web/src/app/admin/pedidos/page.tsx`,
`apps/web/src/components/{checkout-form,panel/order-card}.tsx`,
`apps/web/src/lib/{cart-store,endpoints,order-status,panel-labels}.ts`,
`packages/contracts/package.json`,
`packages/contracts/src/{admin,common,orders,status-flow}.ts`.

**Não são meus:** `apps/api/src/menu/menu.controller.ts` (edição do dono do projeto,
removendo referências a seções do PDF) e `apps/web/next-env.d.ts` (gerado pelo Next).

---

## 6. Desvios do briefing, declarados

1. **Numeração do documento de escopo.** O briefing pediu
   `docs/decisoes/031-escopo-minimo-fase-1.md`. As cinco decisões técnicas da sessão
   foram numeradas antes; ao chegar no F5 elas foram **deslocadas em +1** (agora #32 a
   #36, com as 43 referências no código atualizadas junto) para que o escopo ficasse
   exatamente em #31, como pedido.
2. **`README.md` não existia.** O G4 pede o badge "no topo do README". Foi criado um
   README curto — badge, frase-teste, índice dos documentos e comandos para rodar.
   Criar o arquivo era a única forma de cumprir o item.
3. **`@nestjs/throttler` e `helmet` movidos da raiz para `apps/api/package.json`.**
   Funcionavam por hoisting do npm workspaces, mas um deploy só da API falharia com
   `MODULE_NOT_FOUND`. Enquadrei na permissão de corrigir a configuração de throttler e
   helmet; se não for desejado, é reverter duas linhas.
4. **Correção do estorno.** Não estava listada como item. É a mesma linha de código da
   decisão #32 e se enquadra no critério 1 (pagamento que some do banco). Está descrita
   na decisão #32.
5. **Renomeação do throttler `publica` → `default`.** Necessária para que
   `@Throttle({ default: ... })` sobrescreva por rota; com vários throttlers nomeados,
   todos se aplicariam a todas as rotas.

---

## 7. Problemas encontrados e **não** corrigidos

1. **Armazenamento do throttler em memória.** Reiniciar zera os contadores — um deploy
   no meio de um flood dá cota nova ao atacante; com várias instâncias, o limite efetivo
   vira 120 × número de instâncias. Resolver exige Redis, que é Fase 2 e está proibido.
   Com instância única, só o reinício importa.
2. **`createCheckout` não define expiração no gateway.** Os 15 minutos da decisão #34
   são regra do nosso lado; o QR obedece ao padrão do Mercado Pago, que ainda não foi
   medido. Se divergirem, um pedido pode expirar aqui com o QR ainda válido lá (ou o
   contrário). Está na lista que bloqueia o deploy.
3. **Preferência órfã no gateway em caso de corrida.** Dois cliques simultâneos em
   `POST /payments/checkout/:orderId` podem criar duas preferências no Mercado Pago;
   só uma é persistida e ambas as respostas devolvem a mesma. A perdedora fica sem uso —
   sem efeito financeiro, mas existe.
4. **Projeto dentro do OneDrive.** Continua sendo risco de reincidência (21.382 arquivos
   do `node_modules` viraram placeholders na sessão 04 e quebraram o build). A solução
   definitiva é mover o repositório para fora do OneDrive.

---

## 8. Checklist de prontidão para o sandbox

### No painel do Mercado Pago

1. Criar a aplicação e copiar as **credenciais de teste**: `Access Token` (começa com
   `TEST-`) e a **chave secreta do webhook** (Suas integrações → Webhooks → Configurar
   notificações → assinatura secreta).
2. Cadastrar a URL de notificação apontando para
   `https://<host-da-api>/payments/webhook/mercadopago` e marcar **apenas o tópico
   `payment`**. Os demais tópicos são reconhecidos e ignorados.
3. Criar as contas de teste (comprador e vendedor) para pagar de verdade no sandbox.

### No `apps/api/.env`

```env
MP_ACCESS_TOKEN=TEST-...        # da aplicação de teste
MP_WEBHOOK_SECRET=...           # a assinatura secreta, NÃO o access token
WEB_ORIGIN=http://localhost:3000
TRUST_PROXY_HOPS=0              # 0 local; em produção, o que o provedor indicar
```

### Expor a API para o Mercado Pago alcançar

O webhook é **server-to-server**: `localhost` não serve. Subir um túnel
(`ngrok http 3001` ou equivalente) e usar a URL pública gerada nos passos 2 acima. A URL
muda a cada reinício do túnel — precisa ser reconfigurada no painel.

### Roteiro do teste

1. `docker compose up -d`, `npm run seed:dev -w apps/api`, `npm run create:user -w apps/api`.
2. Subir API e site; fazer um pedido real pelo celular e pagar por Pix na conta de teste.
3. Conferir, em ordem: `payment.checkout_created` no log → notificação chegando →
   `order.paid` → alerta soando no painel.
4. **Repetir a mesma notificação** pelo painel do Mercado Pago ("reenviar") e confirmar
   `already_processed`: um pedido, um alerta.
5. Conferir na tabela `payments` que a linha tem o `gateway_transaction_id` real e que o
   valor bate em centavos com `orders.total_cents`.

### O que observar com atenção

- **A assinatura valida?** É o risco nº 1 desde a sessão 02. Se der 401, comparar o
  manifesto: `id:{data.id};request-id:{x-request-id};ts:{ts};`, com `data.id`
  alfanumérico em minúsculas.
- **O `ts` vem em segundos ou milissegundos?** O código aceita os dois, mas vale
  registrar qual é o real.
- **Quanto tempo leva a consulta ao gateway** dentro do webhook — é o número que falta
  para a medição do E4 ficar completa.
- **Qual é o prazo real do QR Pix**, para alinhar com os 15 minutos da decisão #34.
- **Limites de recebimento da Conta Negócio pessoa física** — perguntar ao suporte antes
  de a operação começar.

---

## 9. Cobertura das duas correções no caminho do dinheiro

Conferido a pedido do dono do projeto, depois da entrega inicial.

| Correção | Onde está o teste |
|---|---|
| Estorno no mesmo id passa a ser registrado | `apps/api/test/payments.e2e-spec.ts` — *"estorno chega no MESMO id do pagamento e é registrado"*: aprova, estorna com o mesmo id, exige `status = refunded` e **uma** linha no pedido. |
| Pagamento tardio grava `paidAfterExpiryAt` | `apps/api/test/payments.e2e-spec.ts` — *"pagamento que chega DEPOIS da expiração volta para aceite, marcado"*: expira, paga, exige `awaiting_acceptance`, `paidAfterExpiryAt` não nulo e **um** `order.paid`. |
| A marca chega ao painel | **Lacuna encontrada e fechada nesta conferência.** `apps/api/test/panel.e2e-spec.ts` — *"pedido pago após expirar chega ao painel COM a marca; pedido normal vem sem ela"*. |

A lacuna era real e silenciosa: `paidAfterExpiryAt` é **opcional** no contrato, então se a
query do painel deixasse de trazê-lo o Zod não reclamaria — a faixa sumiria da tela sem
nenhum sinal. Verificado que o teste não é vazio: com `omit: { paidAfterExpiryAt: true }`
na query do painel ele falha (`expected undefined to be '...'`); revertido, passa.

O que **continua sem teste** é a renderização da faixa no componente React
(`order-card.tsx`). Não há infraestrutura de teste de componente no `apps/web` — só
specs de funções puras. Cobrir exigiria instalar `@testing-library/react` + `jsdom`, o
que precisa de aprovação.

## 10. Commits

Durante a sessão eu não executei nenhum `git add`, `commit` ou `push`. O dono do projeto
commitou o trabalho por conta própria em 2026-09-02 21:04, em quatro commits
(`4bf80af`, `d51c232`, `71a5ca3`, `0be2a33`). Seguiram fora deles, no diretório de
trabalho: `ESTADO.md`, `package.json`, `package-lock.json`, `apps/api/package.json`,
`apps/api/.env.example`, `apps/api/scripts/simulate-payment.mjs` e o
`apps/api/test/panel.e2e-spec.ts` desta conferência.
