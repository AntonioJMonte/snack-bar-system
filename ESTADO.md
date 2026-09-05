# ESTADO DO PROJETO
> Atualizado ao final de cada sessão. É a primeira leitura obrigatória de toda sessão.

## Última sessão: 08 — 2026-09-05 (relatório: docs/relatorios/sessao-08.md)

## Pronto e testado (196 testes: 73 unitários API + 72 e2e API + 51 unitários web/contrato)

**A Fase 1A está funcionalmente completa em código.** Backend, site do cliente,
painel de produção e painel administrativo existem e passam nos testes. O que falta
para declarar a fase pronta é execução em ambiente real, não código — ver pendências.

### Sessão 08 — preparação para o deploy no Railway
Sessão de **prontidão para publicação**, sem funcionalidade nova. O que entrou:
- **`GET /health`** (`src/health/`), sem consulta ao banco e com `@SkipThrottle()`. A
  sonda decide se um deploy é promovido: se ela testasse o Postgres, um blip do banco
  reverteria uma publicação correta. Verificado no binário compilado — 200 requisições
  seguidas, 200 respostas 200, enquanto `GET /menu` no MESMO processo levava 429 a
  partir da 121ª (o controle importa: sem ele o resultado não provaria nada).
- **Log antes do 401 do webhook** (`payment.invalid_webhook_signature` com `transaction`,
  `request-id` e `ts`). Era a última falha silenciosa do caminho do dinheiro: segredo
  trocado, relógio dessincronizado e fraude davam o MESMO 401 sem rastro. Segredo e
  `v1` nunca entram no log. É a ferramenta de diagnóstico do primeiro pagamento real —
  tabela de leitura em `docs/deploy-railway.md` §4.
- **Expiração do Pix passa a ser NOSSA** (#37): `date_of_expiration` na preferência,
  ancorado no `createdAt` do PEDIDO. `CHECKOUT_QR_MINUTES` 15 → 40, folga 10,
  `ORDER_EXPIRY_MINUTES` 25 → 50. Antes o gateway não recebia prazo algum: valia o
  padrão dele (24h) contra um pedido que morria em 25 min, então o QR **sempre**
  sobrevivia ao pedido e `paidAfterExpiryAt` virava rotina.
- **Três falhas silenciosas de configuração viraram falhas altas.** `WEB_ORIGIN` e
  `API_PUBLIC_URL` são obrigatórias (sem padrão de localhost); `NEXT_PUBLIC_API_URL`
  sem valor agora **quebra o `next build`** em vez de assar `localhost:3001` dentro dos
  chunks do navegador. `apps/web` perdeu o `-p 3000` fixo do `start`, que sobrepunha o
  `PORT` do provedor.
- **`docs/deploy-railway.md`**: comandos de build/start, variáveis, criação do primeiro
  admin pelo Console e diagnóstico do webhook.

### Correções da sessão 07 — o que mudou no caminho do dinheiro
Sessão de **fechamento mínimo** antes do sandbox: escopo restrito a perda de dinheiro,
estabilidade e segurança básica (decisão #31). O que entrou:
- **Uma linha de pagamento por transação** (#32). Antes o `upsert` sobrescrevia: cartão
  recusado sumia do banco e um segundo pagamento aprovado não era gravado em lugar
  nenhum. Agora tudo fica, e `/admin/pedidos` mostra "PAGO DUAS VEZES" quando há duas
  aprovadas. Junto: o estorno (que chega no MESMO id) passou a ser registrado — antes
  era engolido pelo curto-circuito de idempotência e **nenhum estorno existia no banco**.
- **Idempotência do pedido e do checkout** (#33): cabeçalho `Idempotency-Key`, chave
  gerada no navegador por checkout; clique repetido devolve o mesmo pedido com 200, e o
  checkout reaproveita a preferência em vez de criar outra no gateway.
- **Expiração do pedido não pago** (#34): status `expired` após 25 min (15 de QR + 10 de
  tolerância). Sem isso, pedidos zumbis ocupariam os 50 slots da reconciliação e a rede
  de segurança contra webhook perdido pararia de funcionar em silêncio. Pagamento tardio
  ressuscita o pedido com faixa "PAGAMENTO FORA DO PRAZO" no painel.
- **Rate limiting completo** (#35): webhook com balde próprio de 600/min (antes dividia
  20/min com todo o resto e assinatura inválida já consumia cota), 60/min no pedido e
  checkout, 120/min no painel, 10/min no login, `TRUST_PROXY_HOPS`, log de todo bloqueio
  e throttler desligado em teste com e2e dedicado que o religa.
- **Robustez do webhook** (#36): `lock_timeout` devolve 503 em vez de 200 (com 200 o
  Mercado Pago NÃO reenvia — era erro meu da sessão 06), timeout de 8s no gateway,
  janela de frescor de 5 min na assinatura e aviso quando o método de pagamento é
  desconhecido.
- **CI e estrutura de deploy**: `.github/workflows/ci.yml` (typecheck, unitários, e2e com
  Postgres em service container, varredura de credencial versionada) e `deploy.yml`
  apenas por `workflow_dispatch`, com o passo de publicação comentado.

### Backend (`apps/api`, sessões 01–03, ajustes na 04–05, 07)
Pedido com valores congelados, pagamento Mercado Pago com webhook idempotente e
evento `order.paid`, auth JWT/argon2id, operações de gerente auditadas, painel via
API, reconciliação agendada, cardápio, horários, regiões, usuários e auditoria.
Acrescentado na sessão 05: `GET /menu/catalog` (catálogo completo, com inativos) e
`GET /orders` (histórico com filtro por status), ambos gerente+.

### Contrato (`packages/contracts`, sessão 04)
Schemas Zod de request/response compartilhados entre API e web, mais as funções
puras que são regra ÚNICA: `priceUnit` (half-up por unidade, decisão #7),
`normalizeBrazilianPhone` e `allowedNextStatus`/`canTransition` (decisão #19). A API
reexporta dos caminhos antigos. Consequência: o preço no carrinho sai da mesma
função que grava o pedido, e o painel não oferece um passo que o servidor rejeite.

### Site do cliente (`apps/web`, sessão 04)
`/` cardápio SSR com busca, filtro, esgotado sinalizado, desconto riscado e aviso de
loja fechada; personalização do item (adicionais somam antes do desconto);
`/carrinho` com nome e telefone obrigatórios, retirada ou entrega, resumo na
estrutura da seção 5.4 — o payload NÃO envia preço; `/pedido/[id]` com polling de
10s e linha do tempo por tipo de entrega.

### Painel de produção (`/painel`, sessão 05)
Login, polling de 6s, som armado por clique (Web Audio, não arquivo), indicador
visual permanente, repetição até o aceite com intervalo por dispositivo (15–20s),
pedido não aceito no topo com destaque, telefone clicável, observação em destaque,
aceite explícito, avanço de status, heartbeat de 30s, Wake Lock e PWA instalável.

### Painel administrativo (`/admin`, sessão 05)
Visão geral (estado da loja com mecanismo vigente; painéis ativos com alerta de
"nenhum painel" e "nenhum som armado"), pedidos com filtro, cardápio completo
(cadastrar categoria/item/adicional, preço, desconto, esgotado, ativar/desativar),
configurações (horário semanal e regiões), usuários e auditoria (admin).

## Decisões tomadas
- #1–#37 em docs/decisoes/. Sessão 04: app único (021), App Router (022), Zustand
  (023), contrato Zod (024). Sessão 05: token em localStorage (025), shadcn/ui (026),
  intervalo do alerta por dispositivo (027), PWA agora e Web Push depois (028),
  catálogo de rotas por caso de uso (029) só no site (030). Sessão 07: escopo mínimo
  (031), pagamento por transação (032), idempotência do pedido (033), expiração do
  pedido (034), rate limiting (035), robustez do webhook (036). Sessão 08: expiração do
  Pix e descarte do sandbox (037).

## Onde ficam as rotas
- **API:** cada `apps/api/src/<dominio>/*.controller.ts` é o arquivo de rotas do seu
  domínio. O caminho é a junção de `@Controller('x')` na classe com `@Get('y')` no
  método — a string completa nunca aparece escrita.
- **Site:** `apps/web/src/routes/` traz o catálogo, um arquivo por caso de uso, com
  método, URL e perfil exigido pelo servidor. As chamadas (fetch, validação Zod,
  cache) seguem em `apps/web/src/lib/*-endpoints.ts`, consumindo o catálogo.
- **Páginas do site:** a pasta é a rota (`apps/web/src/app/**/page.tsx`).

## Pendências e bloqueios

### Bloqueiam declarar a Fase 1A pronta
- **Nunca foi executado ponta a ponta contra o Mercado Pago real.** Continua sendo o
  risco nº 1 desde a sessão 02: a frase-teste da seção 2.2 não foi verificada de
  verdade. **O que mudou na sessão 08: o caminho não é mais o sandbox.** A central de
  ajuda do Mercado Pago documenta que não se paga com Pix em ambiente de teste (não se
  cadastra chave Pix em usuário de teste), então o sandbox nunca validaria o meio de
  pagamento principal. **Item "testar contra o sandbox" ENCERRADO por limitação
  documentada do gateway, não por falha nossa** (decisão #37, parte 1). Substituído por
  teste em PRODUÇÃO com valor mínimo.
- **Nenhuma verificação manual de interface.** Alerta sonoro em cozinha barulhenta,
  Wake Lock, PWA no celular real da loja e notificação em iOS dependem dos aparelhos
  (plano de testes 14.3). Nada disso é coberto por teste automatizado.
- **Não há dados reais.** Cardápio, categorias, adicionais, horários, regiões e
  usuários da loja precisam ser cadastrados (próximos passos 4 a 6 do PDF).

### Verificar com o Mercado Pago antes do deploy
- **Limites de recebimento da Conta Negócio pessoa física.** Confirmar com o suporte
  quais são os tetos de recebimento e se há retenção — o volume da loja não pode
  esbarrar num limite descoberto depois de a operação começar.
- **Prazo real do QR Pix — RESOLVIDO em código, a confirmar no primeiro pagamento.**
  O `createCheckout` agora envia `date_of_expiration = createdAt + 40 min` (#37). Falta
  conferir no QR real que o vencimento exibido é esse, e que o piso de 30 min do gateway
  (premissa do usuário, que NÃO consegui confirmar na documentação) não recusa o valor.
- **Número de saltos de proxy do provedor**, para preencher `TRUST_PROXY_HOPS`. Com o
  valor errado o rate limiting vira limite global e derruba a loja inteira.

### Decisões pendentes do usuário
- **`deploy.yml` continua com a publicação comentada.** Não foi alterado na sessão 08
  (proibido pelo briefing). Enquanto ficar assim, publicar é ato manual no painel do
  Railway. Decidir se o passo entra no workflow.
- **Perfil de três telas:** `GET /orders`, `GET /menu/catalog` e "painéis ativos"
  foram implementados como gerente+; o PDF 5.7 não fixa o perfil. Confirmar.
- **Web Push** (decisão #28 adiou): fazer depois de verificar o aparelho real.
- **Projeto dentro do OneDrive.** 21.382 arquivos do `node_modules` viraram
  placeholders em nuvem e quebraram `tsc` e `next build` na sessão 04. Contornado com
  reinstalação e `attrib +P -U /S /D`, mas **vai reincidir**. A solução definitiva é
  mover o repositório para fora do OneDrive.

### Achados da verificação de deploy (sessão 08, bloco B)
- **Caminho do build da API: `apps/api/dist/main.js`** (sem `src/`), confirmado
  executando o build. Vale porque `tsconfig.build.json` exclui `test`; se alguém incluir
  `test` na compilação, vira `dist/src/main.js`. Por isso o start command do provedor é
  **`npm start -w apps/api`**, não o caminho escrito à mão.
- **`NEXT_PUBLIC_API_URL` é lida no BUILD, não em runtime.** Verificado: o valor é
  gravado em 10 pontos dos chunks de `.next/static`. No provedor precisa existir na hora
  de compilar. Ordem prática: publicar a API, pegar a URL, só então construir o site.
- **`prisma migrate deploy` da raiz não enxerga `apps/api/.env`** (`P1012`). No container
  é indiferente (a variável vem do ambiente); localmente, exportar antes.
- **Não sobrou nada assumindo `localhost` no runtime.** Os dois casos que existiam foram
  corrigidos (`WEB_ORIGIN`, `NEXT_PUBLIC_API_URL`). Restam só ferramentas de
  desenvolvimento em `apps/api/scripts/`, que não entram no container.
- **`npm run create:user` NÃO funciona no container**: o npm script usa
  `node --env-file=.env`, e o `--env-file` falha duro sem o arquivo. Em produção, chamar
  o script direto pelo Console — `docs/deploy-railway.md` §3.
- **O fuso é container-safe.** `store-clock.ts` sempre passa `timeZone` explícito ao
  `Intl`; container em UTC é indiferente.

### Cortado de propósito — não voltar como pendência (decisão #31)
- **Isolar o gateway atrás de interface/porta:** avaliado e cortado. É higiene de
  código, não previne perda de dinheiro; o SDK já está encapsulado em `gateway.ts`.
- **`print_job` e qualquer infraestrutura de impressão:** Fase 2. `printedAt`/
  `printCount` continuam nulos e sem lógica. **Não será reintroduzido.**
- **Redis, BullMQ, WebSocket, fila em processo separado:** Fase 2. Consequência aceita:
  os contadores do rate limiting vivem em memória e zeram no reinício.

### Menores
- **Faixa "PAGAMENTO FORA DO PRAZO" sem teste de renderização.** O elo API→painel está
  coberto (`test/panel.e2e-spec.ts`: o pedido pago após expirar chega com
  `paidAfterExpiryAt`, o normal vem nulo) — é ali que o dado poderia sumir em silêncio,
  porque o campo é opcional no contrato e o Zod não reclamaria. O elo painel→pixel, a
  renderização da faixa em `order-card.tsx`, continua sem teste: cobrir exigiria
  instalar `@testing-library/react` + `jsdom`, o que **não se encaixa nos critérios da
  sessão 07** (decisão #31). Verificação manual, uma vez, no teste em produção.
- Intervalo/janela da reconciliação são constantes (60s / 5 min); a expiração usa
  `ORDER_EXPIRY_MINUTES` (50) em `src/common/order-expiry.ts`.
- Armazenamento do throttler em memória: reinício zera contadores; várias instâncias
  multiplicariam o limite. Resolver exigiria Redis, que é Fase 2.
- `npm audit`: 3 high no CLI do Prisma (dev-only) — risco aceito (sessão 02).
- Ao recriar `node_modules`, rodar `npm run prisma:generate -w apps/api` antes de
  compilar a API — sem isso o build falha com "@prisma/client has no exported member".

## Como rodar localmente
Passo a passo em **docs/como-testar.md** (verificado de ponta a ponta em 2026-09-01).
Portas: **API 3001**, **site 3000**. Ferramentas de desenvolvimento em
`apps/api/scripts/`: `seed:dev` (cardápio e horários de exemplo), `create:user`
(primeiro acesso ao painel) e `simulate:payment` (marca um pedido como pago para
exercitar o painel sem credenciais do gateway — não substitui o webhook real).

## Próximo passo concreto (sessão 09)
**Publicar no Railway e fazer o primeiro pagamento real de valor mínimo.** Passo a passo
completo em **docs/deploy-railway.md**. Na ordem:

1. **Postgres + serviço da API.** Variáveis da §2; `prisma migrate deploy`. Conferir
   `GET /health` respondendo `{"ok":true}`.
2. **Webhook no painel do Mercado Pago**, aba **Produção**, e copiar a assinatura
   secreta gerada para `MP_WEBHOOK_SECRET`. É o ato de salvar que gera o segredo.
3. **Serviço do site**, com `NEXT_PUBLIC_API_URL` apontando para a API **antes** do
   build.
4. **Primeiro admin pelo Console** (§3), depois cardápio real, horários e regiões por
   `/admin`.
5. **Pagamento real de valor mínimo, por Pix.** É o teste de verdade. Conferir, nesta
   ordem:
   - o webhook chega e o pedido confirma;
   - se der 401, ler `payment.invalid_webhook_signature` e usar a tabela da §4 para
     separar "notificação sem assinatura" de "segredo da aba errada";
   - o vencimento que o QR realmente exibe (confirma ou derruba a premissa dos 40 min
     da decisão #37);
   - a faixa "PAGAMENTO FORA DO PRAZO" NÃO deve aparecer num pagamento normal;
   - `TRUST_PROXY_HOPS`: se todos os bloqueios do throttler mostrarem o mesmo IP, o
     número está errado e o rate limiting virou limite global.
6. **Depois disso:** plano de testes da seção 14 nos aparelhos reais da loja (14.2 e
   14.3 — alerta sonoro em cozinha barulhenta, Wake Lock, PWA, iOS), que nenhum teste
   automatizado cobre.

Só então a Fase 1A pode ser declarada pronta.
