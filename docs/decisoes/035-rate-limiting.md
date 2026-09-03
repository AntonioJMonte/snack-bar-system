# DECISÃO #35 — Rate limiting completo

**Data:** 2026-09-02 (sessão 07)

**Contexto:** `@nestjs/throttler` e `helmet` já estavam instalados pelo dono do projeto,
com um balde único de 20 requisições por 60 segundos e `APP_GUARD` global. A auditoria
da sessão 07 mostrou que a configuração estava incompleta e tinha um problema grave em
produção. Todos os pontos abaixo foram **pré-aprovados** no briefing.

## O que a auditoria encontrou

| Item | Achado |
|---|---|
| Webhook | Sujeito ao balde de 20/min. O guard roda **antes** do handler, então requisição com assinatura inválida já consumia cota. Comprovado: 20×401 e depois 429. |
| `trust proxy` | Inexistente. `getTracker` devolve `req.ip` puro — atrás de proxy, todos os clientes cairiam no mesmo balde. |
| Painel | Polling de 6s = 10 req/min por aparelho. PC e celular no mesmo NAT = 20/min exatos, **em cima do limite**. |
| Armazenamento | `ThrottlerStorageService` em memória: reinício zera contadores; múltiplas instâncias multiplicam o limite. |
| Suíte e2e | Passava por **margem**, não por desenho: 12 de 20 chamadas ao webhook no arquivo de pagamentos. |

## Resultado

**Um único throttler nomeado `default`** (120/min por IP), com as rotas que precisam de
número próprio sobrescrevendo via `@Throttle({ default: {...} })`. Vários throttlers
nomeados se aplicariam **todos** a **todas** as rotas, obrigando a pendurar
`@SkipThrottle` em cada handler — mais peça para dar errado.

| Grupo | Limite | Por quê |
|---|---|---|
| Webhook do Mercado Pago | **600/min** | O cenário que manda no número não é o volume normal: é quando o MP volta de uma instabilidade e despeja o acúmulo de notificações de uma vez. É exatamente aí que barrar significa pagamento não confirmado. |
| `POST /orders`, `POST /payments/checkout/:orderId` | **60/min por IP** | CGNAT de operadora móvel: dezenas de clientes distintos saem pelo mesmo IP público numa sexta à noite. |
| Rotas do painel | **120/min por IP** | PC e celular da loja saem pelo mesmo NAT; 20/min estourava com dois aparelhos. |
| `POST /auth/login` | **10/min por IP** | Defesa contra força bruta, não contra volume. Dois atendentes errando a senha não podem travar o terceiro. |

**`TRUST_PROXY_HOPS`** (padrão `0`, aplicado em `main.ts`). Sem isto, atrás de
Railway/Render/Cloudflare o `req.ip` vira o IP do proxy e o rate limiting deixa de
proteger por cliente — passa a derrubar a loja inteira. O número correto vem do provedor
e só é definido no deploy; o mecanismo fica pronto agora, com padrão seguro.

**Desligado quando `NODE_ENV=test`** (`skipIf`), com escape `THROTTLE_E2E=1`. A suíte
passava por margem e o próximo teste escrito quebraria com um 429 disfarçado de bug de
pagamento. `apps/api/test/throttler.e2e-spec.ts` liga de propósito e verifica três
coisas: rota pública devolve 429 ao estourar, webhook **não** devolve no mesmo volume, e
todo bloqueio vira log.

**`LoggingThrottlerGuard`** — todo bloqueio gera `logger.warn` com método, rota, IP,
handler, contador e limite. Rate limit falha em silêncio por natureza, e este sistema
inteiro foi desenhado contra falha silenciosa: webhook barrado é pagamento não
confirmado; cliente barrado no checkout é venda perdida invisível.

## Também nesta decisão (Bloco F)

- **`helmet` com `crossOriginResourcePolicy: cross-origin`.** O padrão `same-origin` é
  feito para quem serve páginas e recursos; a API devolve JSON para um site em outro
  domínio, e o padrão passaria a bloquear no dia em que a API servir imagem do cardápio.
  O CORS continua sendo a barreira de verdade: só `WEB_ORIGIN` lê as respostas.
- **Limite de corpo explícito de 100kb** em `main.ts`. Era 100kb por herança do
  `express.json()`, não por decisão — mesmo valor, agora escrito onde alguém acha.
- **`@nestjs/throttler` e `helmet` movidos da raiz para `apps/api/package.json`**, onde
  está o código que os importa. Funcionavam por hoisting do npm workspaces; um deploy só
  da API falharia com `MODULE_NOT_FOUND`.

## Limitação conhecida, não resolvida

O armazenamento continua **em memória do processo**: reiniciar zera os contadores e cada
instância mantém o próprio balde. Com instância única (o caso hoje) só o reinício
importa. Resolver exigiria Redis, que é Fase 2 e está proibido.
