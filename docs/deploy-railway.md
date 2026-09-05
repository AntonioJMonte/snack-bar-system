# Publicação no Railway

Dois serviços a partir deste monorepo (`apps/api` e `apps/web`) mais um Postgres
gerenciado. Escrito na sessão 08; os comandos foram executados de verdade a partir da
raiz do repositório, o que está marcado como **a confirmar** não foi.

> **O teste do gateway é em PRODUÇÃO, com valor mínimo.** O sandbox foi descartado por
> limitação documentada do Mercado Pago (não se paga com Pix em usuário de teste) —
> decisão #37, parte 1.

---

## 1. Comandos de build e start

### Serviço da API

```
Build:  npm ci && npm run build -w packages/contracts && npm run prisma:generate -w apps/api && npm run build -w apps/api
Start:  npm start -w apps/api
```

**Use `npm start -w apps/api`, não o caminho do arquivo.** Hoje o build produz
`apps/api/dist/main.js` (sem `src/` no meio) porque `tsconfig.build.json` exclui `test`,
o que faz o `rootDir` inferido ser `src`. Se um dia alguém incluir `test` na compilação,
a saída vira `dist/src/main.js` e um caminho fixo aqui quebra o deploy sem aviso. O
`package.json` já é dono dessa resposta — deixe que ele responda.

O `prisma generate` **precisa** rodar no build, no mesmo ambiente que vai executar: é
ele que baixa o engine binário certo para o Linux do container.

### Serviço do site

```
Build:  npm ci && npm run build -w packages/contracts && npm run build -w apps/web
Start:  npm start -w apps/web
```

`npm start` roda `next start` sem `-p`, então o Next respeita o `PORT` que o Railway
injeta. (Até a sessão 08 o script tinha `-p 3000` fixo, que sobrepunha o `PORT` da
plataforma.)

### Migrações

```
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

Rodar **depois** de o Postgres existir e **antes** (ou como parte) do primeiro start da
API. Funciona no container porque a plataforma injeta `DATABASE_URL` no ambiente do
processo.

⚠️ **Na sua máquina, esse comando falha rodado da raiz** com
`P1012 — Environment variable not found: DATABASE_URL`: o Prisma não carrega o
`apps/api/.env` quando o schema vem por `--schema` a partir da raiz. Localmente,
exporte a variável antes.

---

## 2. Variáveis de ambiente

### API — todas obrigatórias, a aplicação não sobe sem elas

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | injetada pelo Railway |
| `DATABASE_URL` | do Postgres do projeto |
| `STORE_TIMEZONE` | `America/Sao_Paulo` |
| `JWT_SECRET` | segredo próprio, mínimo 16 caracteres |
| `JWT_TTL` | `12h` |
| `MP_ACCESS_TOKEN` | credencial de **produção** do Mercado Pago |
| `MP_WEBHOOK_SECRET` | segredo gerado no painel do MP — ver seção 4 |
| `API_PUBLIC_URL` | URL pública **deste serviço**; vira o `notification_url` da preferência |
| `WEB_ORIGIN` | URL pública do site |
| `TRUST_PROXY_HOPS` | **a confirmar com o Railway** — ver seção 5 |

`WEB_ORIGIN` e `API_PUBLIC_URL` perderam o padrão de `localhost` na sessão 08 de
propósito: com padrão, a API subia verde e errada — o CORS barrava o site de verdade e
as `back_urls` mandavam o cliente de volta para a máquina dele.

### Site — obrigatória, **lida no BUILD**

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL pública do serviço da API |

**O prefixo `NEXT_PUBLIC_` faz o Next gravar o valor dentro dos chunks do navegador
durante o `next build`.** Ela não é lida em runtime: precisa existir no momento de
compilar. Se faltar, o `next build` **falha de propósito** (desde a sessão 08) com uma
mensagem dizendo isso — antes havia um `?? 'http://localhost:3001'` silencioso que
produzia um deploy verde mandando o celular do cliente falar com o próprio localhost.

Ordem prática: publique a API primeiro, pegue a URL dela, e só então construa o site.

---

## 3. Primeiro admin em produção

A criação de usuário pela API é exclusiva do admin — então o primeiro admin não pode
nascer pela API. Ele nasce por script, direto no banco.

**Pela aba Console do serviço da API no Railway:**

```
node apps/api/scripts/create-user.mjs <email> <senha> admin <Nome Completo>
```

**Chame o script direto, NÃO use `npm run create:user -w apps/api`.** O npm script é
`node --env-file=.env scripts/create-user.mjs`, e o `--env-file` do Node **falha duro**
se o arquivo não existir (`node: .env: not found`). No container não existe `.env`: as
variáveis vêm do ambiente, que é exatamente o que o script precisa. O `--env-file` só
serve ao uso local.

Perfis aceitos: `attendant`, `manager`, `admin`. Depois disso, o resto dos usuários da
loja entra por `/admin/usuarios`.

O `seed:dev` **não serve aqui**: além do mesmo problema de `--env-file`, ele recusa
rodar contra qualquer banco que não se chame `lanchonete_dev`. O cardápio real entra
por `/admin/cardapio`.

---

## 4. Webhook do Mercado Pago

O `notification_url` da preferência é montado a partir de `API_PUBLIC_URL`:

```
{API_PUBLIC_URL}/payments/webhook/mercadopago
```

**Ainda assim, configure o webhook no painel do Mercado Pago** (Suas integrações →
sua aplicação → Webhooks, aba **Produção**) e salve. É o ato de salvar que **gera a
assinatura secreta da aplicação** — o valor que vai em `MP_WEBHOOK_SECRET`. Sem essa
configuração não existe segredo nenhum para validar.

A documentação do Mercado Pago diz que a URL da preferência **tem precedência** sobre a
do painel:

> "As URLs configuradas durante a criação do pagamento terão prioridade sobre aquelas
> configuradas através de Suas integrações."

Ou seja: o painel define **o segredo** (por aplicação), a preferência define **o
destino**. As duas coisas são necessárias.

⚠️ **A aba Produção e a aba Teste têm segredos diferentes.** Usar o segredo da aba
errada produz 401 em todo pagamento — e nada mais, porque um 401 não diz por quê.

### Como diagnosticar o 401 no primeiro pagamento real

O log adicionado na sessão 08 existe para este momento:

```
payment.invalid_webhook_signature transaction=<id> request-id=<id> ts=<ts>
```

| O que aparece | O que significa |
|---|---|
| nenhuma linha, e o pagamento confirma | tudo certo |
| `ts=(ausente)` e `request-id=(ausente)` | **a notificação chegou SEM assinatura** — o `x-signature` não veio |
| `ts` presente, mas 401 | assinatura veio e não bateu: segredo errado (provavelmente da aba Teste) |
| `ts` presente e muito distante do horário atual | relógio fora de sincronia — a janela de frescor é de 5 min (decisão #36) |

O segundo caso é o que ainda não conseguimos confirmar na documentação: não achamos
declaração explícita de que notificações entregues a um `notification_url` **da
preferência** também chegam assinadas. O que a documentação diz é que a assinatura
pertence à **aplicação** ("Ao salvar, será gerada uma única assinatura secreta para sua
aplicação"), o que sugere que sim — mas é inferência, não citação. Este log é a prova.

---

## 5. `TRUST_PROXY_HOPS` — confirmar antes de abrir a loja

Número de saltos de proxy entre o cliente e a aplicação, para o Express descobrir o IP
real. **Com o valor errado o rate limiting deixa de contar por cliente e passa a contar
todo mundo no mesmo balde — um cliente movimentado derruba a loja inteira.**

Não há como acertar isso por dedução: o número vem do provedor. Confirme com o Railway
e valide olhando o IP que a API registra nos bloqueios (`LoggingThrottlerGuard`) — se
todos os bloqueios mostrarem o mesmo IP, o número está errado.

---

## 6. Ainda não automatizado

`.github/workflows/deploy.yml` roda a suíte inteira por `workflow_dispatch` e tem o
passo de publicação **comentado**, com um `TODO(provedor)`. Não foi alterado nesta
sessão. Enquanto continuar assim, a publicação é feita pelo painel do Railway.
