# Sessão 08 — Preparação para deploy no Railway

**Data:** 2026-09-05
**Objetivo:** deixar a aplicação publicável em dois serviços do Railway + Postgres
gerenciado, e testável em **produção** com contas reais do Mercado Pago. Nenhuma
funcionalidade nova; escopo restrito aos quatro critérios da decisão #31.

**Mudança de rota que define a sessão:** o item "testar contra o sandbox" do ESTADO.md
foi **encerrado sem ser feito**. A central de ajuda do Mercado Pago documenta que não se
paga com Pix em ambiente de teste (não se cadastra chave Pix em usuário de teste), então
o sandbox nunca validaria o meio de pagamento principal do PDF. Registrado na decisão
#37, parte 1, com a ressalva explícita de que é limitação documentada do gateway e não
falha nossa.

---

## 1. Saída real dos testes

```
npm run typecheck                    exit=0  (api, web, contracts)

npm run test --workspaces
  apps/api          Test Files  9 passed (9)    Tests  73 passed (73)
  web + contracts   Test Files  5 passed (5)    Tests  51 passed (51)

npm run test:e2e -w apps/api
                    Test Files 10 passed (10)   Tests  72 passed (72)
```

**Total: 196 testes.** Antes da sessão eram 195. Os dois testes novos estão dentro de
`payments.e2e-spec.ts` (16 → 17 casos); o caso de assinatura inválida que já existia
ganhou as asserções de log em vez de virar teste separado.

---

## 2. Bloco A — pré-aprovado

### A1. `listen('0.0.0.0')`

**Já estava aplicado na árvore de trabalho antes desta sessão**, junto com outras
alterações não commitadas (`API_PUBLIC_URL` em `env.ts`, `notification_url` em
`gateway.ts`, os scripts `check-token.mjs` e `test-webhook.mjs`). Conferido e mantido.
Não é trabalho desta sessão — registrado aqui para o commit não atribuir errado.

### A2. `GET /health`

`src/health/health.controller.ts` + `health.module.ts`, registrado em `app.module.ts`
no mesmo padrão dos outros domínios. Sem consulta ao banco, com `@SkipThrottle()`.

**Sobre o alerta do briefing quanto a guard global: não existe guard global de
autenticação nesta API.** A proteção é *opt-in*, por rota, com
`@UseGuards(JwtAuthGuard, RolesGuard)` — o `POST /orders` não usa decorator de rota
pública, ele simplesmente não é guardado. O único `APP_GUARD` é o
`LoggingThrottlerGuard`. Logo `/health` já nasce público e **não havia decorator a
aplicar**; o `@SkipThrottle()` era o único que faltava.

Verificado no **binário compilado**, não em teste:

```
GET /health                    -> {"ok":true}  HTTP 200
200 requisições seguidas       -> 200x HTTP 200          (SkipThrottle funciona)
controle: 140x GET /menu       -> 120x 200, 20x 429      (throttler ativo no MESMO processo)
```

O controle é o que dá valor à primeira linha: sem ele, "200 respostas 200" poderia
significar apenas que o throttler estava desligado.

Motivo de a rota não tocar o banco, escrito no código: a sonda decide se um deploy é
promovido e se o container continua de pé. Uma sonda que testa a dependência transforma
um blip do Postgres em reversão de um deploy correto — e em reinício em laço de um
serviço que estava funcionando.

### A3. Log antes do 401 do webhook

`payments.controller.ts` passa a emitir, antes de lançar a `UnauthorizedException`:

```
payment.invalid_webhook_signature transaction=<data.id> request-id=<x-request-id> ts=<ts>
```

O `ts` sai de um helper local que lê **só** o par `ts=` do `x-signature`. O `v1` nunca é
lido nem logado — é material derivado do segredo.

Por que isso importa mais do que parece: era a última falha silenciosa do caminho do
dinheiro. Segredo trocado no painel do Mercado Pago, relógio do container fora de
sincronia (a janela de frescor da #36 é de 5 min) e tentativa de fraude produziam
**exatamente o mesmo 401**, sem rastro nenhum. Do lado do gateway o sintoma é só
"notificação falhou": o pagamento existe lá e o pedido nunca confirma aqui.

Um teste, dentro do caso que já existia (`assinatura inválida: 401, nada confirmado`),
sem arquivo novo. Afirma os três campos e que `segredo-errado` e `v1=` **não** aparecem
na linha.

Tabela de leitura desse log no primeiro pagamento real: `docs/deploy-railway.md` §4.

---

## 3. Bloco B — verificação

### B1. Caminho do build: `apps/api/dist/main.js`

Sem `src/` no meio. Confirmado executando o build, não lendo config. A razão:
`tsconfig.build.json` exclui `test`, então o `rootDir` inferido é `src`.

**É frágil.** Compilar com o `tsconfig.json` cheio (que inclui `["src", "test"]`) sobe o
`rootDir` para `apps/api` e a saída vira `dist/src/main.js`. Por isso o start command
recomendado é `npm start -w apps/api` (item 5 dos pré-aprovados): o `package.json` já é
dono dessa resposta, e um caminho escrito à mão no painel do provedor quebraria sem
aviso.

### B2. `NEXT_PUBLIC_API_URL`

Sim, é prefixada — e o efeito é pior do que "lida em build". Compilei o site e **o valor
fica gravado dentro dos chunks do navegador**: `grep` em `.next/static` encontrou
`http://localhost:3001` em **10 pontos**, vindo do fallback que existia em
`apps/web/src/lib/api.ts`.

Consequência: variável ausente no build do provedor = deploy verde que manda o **celular
do cliente** falar com o próprio `localhost:3001`. Nada quebra; a loja simplesmente não
vende. Corrigido no item 2 dos pré-aprovados.

Colateral tranquilizador, verificado por engano ao investigar: **`next build` não precisa
da API no ar.** `/` sai como `ƒ (Dynamic) — server-rendered on demand`, não
pré-renderizada. Construí com a API desligada e o build passou. Eu havia levantado isso
como risco; o teste derrubou a hipótese.

### B3. Os comandos da raiz

| Comando | Resultado |
|---|---|
| `npm ci` | ✅ 473 pacotes, 45s |
| `npm run build -w packages/contracts` | ✅ |
| `npm run prisma:generate -w apps/api` | ✅ |
| `npm run build -w apps/api` | ✅ → `dist/main.js` |
| `npx prisma migrate deploy --schema apps/api/prisma/schema.prisma` | ⚠️ ver abaixo |

O `migrate deploy` **falhou rodado da raiz**: `P1012 — Environment variable not found:
DATABASE_URL`. O Prisma não carrega `apps/api/.env` quando o schema vem por `--schema` a
partir da raiz. Subi o Postgres do Compose e rodei com a variável no ambiente:

```
4 migrations found in prisma/migrations
No pending migrations to apply.   ✅
```

**No Railway isso não é problema** — a plataforma injeta `DATABASE_URL` no ambiente do
processo, que é exatamente o caso que funcionou. Mas o comando não roda como está numa
máquina de desenvolvimento sem exportar a variável antes.

### B4. O que assumia localhost / porta fixa / arquivo local

Levantado como relato; os três primeiros viraram correção pré-aprovada depois.

1. `"start": "next start -p 3000"` — o `-p` sobrepunha o `$PORT` do Railway. **Corrigido.**
2. Fallback `http://localhost:3001` em `api.ts`. **Corrigido.**
3. `WEB_ORIGIN` com padrão `http://localhost:3000`. **Corrigido.**
4. `"create:user": "node --env-file=.env ..."` — o `--env-file` do Node falha duro sem o
   arquivo (confirmado: `node: .nao-existe: not found`). No container não há `.env`, logo
   **não havia caminho suportado para criar o primeiro admin em produção**. O script em
   si é container-safe. **Documentado, não alterado** (`docs/deploy-railway.md` §3).
5. `"seed:dev"` — mesmo problema, mais a recusa de rodar fora de `lanchonete_dev`.
   Correto que seja assim; o cardápio real entra por `/admin/cardapio`.
6. `apps/api/scripts/test-webhook.mjs` — domínio ngrok fixo como padrão e leitura de
   `.env` do disco. Ferramenta de desenvolvimento, não entra no runtime.

**Não é problema:** o fuso. `store-clock.ts` sempre passa `timeZone` explícito ao `Intl`
e nunca usa a hora local do processo — container em UTC é indiferente. Nenhum
`readFile` / `__dirname` / `process.cwd()` em `src/`.

---

## 4. Bloco C — decisão #37 implementada

Registro completo em `docs/decisoes/037-expiracao-do-pix.md`.

Duas correções factuais que mudaram o enunciado antes da decisão:

- **O campo é `date_of_expiration`, não `expiration_date_to`.** Confirmado nos tipos do
  SDK instalado: `date_of_expiration` é *"expiration date after which the preference
  cannot be paid"*; `expiration_date_from`/`_to` são a *janela de ativação da
  preferência*, coisa diferente. Fixar o campo errado não teria efeito nenhum sobre o QR
  e o sintoma seria silencioso.
- **O piso de 30 min é premissa, não fato verificado por mim.** As páginas de
  *expiration date* do Checkout Pro que consegui abrir não documentam mínimo nem padrão
  para Pix. A fonte apontada pelo usuário está citada na ADR, marcada como a confirmar
  no primeiro pagamento real.

Decidido pelo usuário: **Opção A com margem** — `date_of_expiration = createdAt + 40min`,
`CHECKOUT_QR_MINUTES` 15 → 40, folga 10, `ORDER_EXPIRY_MINUTES` 25 → 50. A margem de 10
sobre o piso cobre uma diferença de âncora que a recomendação original não tinha visto:
nosso relógio conta da criação do **pedido**; o piso do gateway conta da criação do
**pagamento**, que no Checkout Pro nasce depois.

Implementado em `common/order-expiry.ts`, `payments/gateway.ts` (campo novo na
preferência) e `payments/payments.service.ts` (passa `order.createdAt`).
`CheckoutPreferenceInput` ganhou `orderCreatedAt`.

**A âncora é o `createdAt` do PEDIDO, não `new Date()`.** A preferência é reaproveitada
(#33); ancorar em "agora" faria o QR nascer com prazo cheio a partir de um pedido já
velho — a inversão que a #37 existe para eliminar. Um e2e novo trava isso.

---

## 5. Pré-aprovados da continuação

| # | Item | Verificação |
|---|---|---|
| 1 | `-p 3000` removido de `start` em `apps/web` | `dev` mantém a porta fixa (convenção local); `start` agora respeita `$PORT` |
| 2 | Fallback de `api.ts` removido; build falha sem a variável | Build **falhou** com a mensagem esperada; com a variável, passou e gravou a URL certa em 10 pontos dos chunks, com **zero** ocorrências de `localhost:3001` |
| 3 | `WEB_ORIGIN` obrigatória | `test-env.ts` ganhou o valor; suíte verde |
| 4 | `API_PUBLIC_URL` no `.env.example` | Placeholder `http://localhost:3001`, sem credencial |
| 5 | Start command `npm start -w apps/api` | Documentado em `docs/deploy-railway.md` §1 e no B1 acima |
| 6 | Primeiro admin pelo Console do Railway | `docs/deploy-railway.md` §3 |

O item 2 é o mais importante da lista: trocou uma falha silenciosa por uma falha alta,
que é a política do projeto inteiro. A mensagem de erro diz o que fazer e por quê.

---

## 6. Relatar, não corrigir — `notification_url` e assinatura

**Pergunta:** com `notification_url` na preferência, as notificações chegam assinadas?
Se não chegarem, o webhook devolve 401 em todo pagamento.

**O que encontrei na documentação:**

1. **Existem os dois caminhos, e a preferência tem precedência sobre o painel:**
   > "As URLs configuradas durante a criação do pagamento terão prioridade sobre aquelas
   > configuradas através de Suas integrações."

2. **O segredo pertence à APLICAÇÃO, não à URL**, e nasce ao salvar a configuração no
   painel:
   > "Ao salvar, será gerada uma única assinatura secreta para sua aplicação, permitindo
   > validar a autenticidade das notificações recebidas."

3. A única exceção explícita que achei para a assinatura é outra: *"notificações de
   integrações QR Code não podem ser verificadas usando a assinatura secreta"* — não é o
   nosso caso (usamos Checkout Pro).

**Leitura que isso sustenta:** a assinatura é propriedade da aplicação; o
`notification_url` decide apenas **para onde** a notificação vai. Logo, deve continuar
assinada. **Mas isto é inferência, não citação** — não achei declaração explícita de que
notificações entregues a um `notification_url` da preferência chegam assinadas, e não
vou registrar inferência como fato num sistema que movimenta dinheiro.

**Consequência prática, que vale independentemente da dúvida:** é obrigatório configurar
o webhook no painel (Suas integrações → Webhooks, aba **Produção**) e salvar, porque é
isso que **gera** o `MP_WEBHOOK_SECRET`. Sem essa configuração não existe segredo nenhum,
e aí a validação falha com certeza. Painel define o segredo; preferência define o
destino. As duas coisas.

**Como o A3 resolve a dúvida no primeiro pagamento real** — é o payoff do log:

| O que aparece | O que significa |
|---|---|
| nada, e o pagamento confirma | assinado e válido: dúvida encerrada a favor |
| `ts=(ausente)` e `request-id=(ausente)` | chegou **sem assinatura** — a hipótese ruim se confirmou |
| `ts` presente, mas 401 | veio assinado e o segredo é que está errado (provavelmente o da aba Teste) |
| `ts` presente e muito distante do agora | relógio fora de sincronia |

Sem o A3, esses quatro casos seriam o mesmo 401 mudo. **`gateway.ts` não foi alterado**,
como pedido.

---

## 7. Desvios declarados

- **A1 não é trabalho desta sessão.** Já estava na árvore de trabalho, junto de outras
  alterações não commitadas de trabalho anterior (`API_PUBLIC_URL`, `notification_url`,
  dois scripts). Conferi e mantive, mas o crédito não é daqui.
- **Escrevi dois testes, não um.** O briefing original dizia "não escreva teste além do
  necessário para cobrir o A3". O segundo cobre a âncora do `date_of_expiration`
  (decisão #37), que veio depois e é caminho do dinheiro: trocar `order.createdAt` por
  `new Date()` restauraria a inversão que a #37 elimina, **sem quebrar nada**. Julguei
  proporcional; se discordar, é um `it` para remover.
- **Alterei `apps/web/.env.example` além do pedido.** O item 4 autorizava só o
  `API_PUBLIC_URL` no `.env.example` da API. Como o item 2 tornou `NEXT_PUBLIC_API_URL`
  obrigatória sob pena de o build falhar, deixar o comentário antigo ("ajuste se a API
  não estiver em localhost:3001") seria documentação que mente. Só comentário e ênfase;
  o valor placeholder é o mesmo.
- **`docs/deploy-railway.md` é arquivo novo, não pedido explicitamente.** O item 6 pedia
  documentar em `docs/` a criação do primeiro admin; o item 5 pedia documentar o start
  command "no relatório". Juntei os dois num guia de deploy porque relatório de sessão é
  registro histórico, e quem vai publicar daqui a duas semanas não vai procurar o start
  command em `sessao-08.md`. O relatório mantém as duas informações.
- **`apps/web/next-env.d.ts` foi revertido.** Rodar `next build` reescreve esse arquivo
  gerado (ele alterna entre `.next/dev/types/` e `.next/types/` conforme o último
  comando). Revertido para não sujar o diff com ruído de ferramenta.
- **`deploy.yml` não foi tocado**, conforme proibido no briefing. Continua com a
  publicação comentada e o `TODO(provedor)`.

---

## 8. Problemas encontrados e NÃO corrigidos

- **A conversão para ISO do `date_of_expiration` não tem teste.** O e2e cobre o elo
  `payments.service` → gateway (que a âncora é o `createdAt` do pedido), mas o
  `MercadoPagoClient` é substituído por um fake, então o corpo que chega ao SDK não é
  exercitado. Cobrir exigiria mockar o SDK — máquina nova, fora dos critérios da #31.
  **Verificação: manual, no primeiro pagamento real**, olhando o vencimento que o QR
  exibe.
- **O piso de 30 min do gateway continua sendo premissa.** Não consegui confirmá-lo nas
  páginas de documentação que abri. Se o piso for contado como "30 min a partir de
  agora" e não como janela, `createdAt + 40` pode ser recusado quando houver atraso
  grande entre pedido e checkout. Na prática o checkout é pedido segundos depois, mas
  isso só se prova em produção.
- **Não sei se `notification_url` da preferência chega assinado.** Seção 6. Fica
  registrado como a dúvida em aberto de maior consequência — se a resposta for "não", o
  webhook devolve 401 em todo pagamento e o desenho do `MP_WEBHOOK_SECRET` precisa
  mudar.
- **`TRUST_PROXY_HOPS` continua sem número.** Não é dedutível; vem do provedor. Com o
  valor errado o rate limiting deixa de contar por cliente e derruba a loja inteira.
  Como conferir está em `docs/deploy-railway.md` §5.
- **Faixa "PAGAMENTO FORA DO PRAZO" continua sem teste de renderização** (pendência
  herdada da sessão 07). Agora com um agravante inverso: se a #37 funcionar, a faixa
  passa a ser ainda mais rara, então a verificação manual precisa ser **forçada** (marcar
  um pedido como `expired` à mão antes de pagar), não esperada.
- **`npm audit`: 4 vulnerabilidades (1 moderada, 3 altas)** no `npm ci` desta sessão —
  as 3 altas continuam sendo o CLI do Prisma, dev-only, risco aceito desde a sessão 02.
  A moderada é nova nesta contagem e **não foi investigada**.
- **O repositório continua dentro do OneDrive.** Pendência da sessão 04, que "vai
  reincidir". Não reincidiu nesta sessão.

---

## 9. Arquivos a commitar

**Nada chega ao Railway sem estar no `main`.** Branch atual: `sessao-07-fechamento`.

### Trabalho desta sessão

```
A  apps/api/src/health/health.controller.ts
A  apps/api/src/health/health.module.ts
M  apps/api/src/app.module.ts                    (registra o HealthModule)
M  apps/api/src/payments/payments.controller.ts  (A3: log antes do 401)
M  apps/api/src/common/order-expiry.ts           (#37: 40 + 10 = 50)
M  apps/api/src/payments/payments.service.ts     (#37: passa orderCreatedAt)
M  apps/api/src/config/env.ts                    (WEB_ORIGIN obrigatória)
M  apps/api/.env.example                         (API_PUBLIC_URL + nota de WEB_ORIGIN)
M  apps/api/test/payments.e2e-spec.ts            (2 testes)
M  apps/api/test/test-env.ts                     (WEB_ORIGIN)
M  apps/web/src/lib/api.ts                       (sem fallback; falha no build)
M  apps/web/package.json                         (start sem -p 3000)
M  apps/web/.env.example                         (variável obrigatória)
A  docs/decisoes/037-expiracao-do-pix.md
A  docs/deploy-railway.md
A  docs/relatorios/sessao-08.md
M  ESTADO.md
```

### Já estava na árvore, de trabalho anterior — precisa entrar junto

Sem estes quatro a API não sobe (o `API_PUBLIC_URL` é obrigatório em `env.ts` e o
`gateway.ts` depende dele):

```
M  apps/api/src/main.ts                          (listen 0.0.0.0)
M  apps/api/src/config/env.ts                    (API_PUBLIC_URL — mesmo arquivo acima)
M  apps/api/src/payments/gateway.ts              (notification_url + date_of_expiration)
M  apps/api/test/test-env.ts                     (API_PUBLIC_URL — mesmo arquivo acima)
```

### Decidir antes de commitar

```
?  apps/api/scripts/check-token.mjs
?  apps/api/scripts/test-webhook.mjs
```

Não são meus e não foram usados nesta sessão. São úteis para o teste em produção
(`check-token.mjs` confere se o `MP_ACCESS_TOKEN` é aceito sem imprimir o token;
`test-webhook.mjs` assina um webhook e dispara contra a API). Nenhum dos dois contém
credencial — ambos leem do `.env`. **Mas `test-webhook.mjs` tem um domínio ngrok fixo
como padrão**, que vira lixo assim que o túnel morrer. Sugestão: commitar os dois em
`apps/api/scripts/`, trocando o padrão do ngrok por leitura obrigatória de
`WEBHOOK_BASE`. Não fiz — está fora do escopo aprovado.

### Cuidado antes do merge

A varredura de credencial do CI (`.github/workflows/ci.yml`, job `segredos`) rejeita
qualquer `.env` rastreado e padrões de token. `apps/api/.env` **não** está rastreado e
deve continuar assim; os dois `.env.example` alterados só têm placeholders.
