# ESTADO DO PROJETO
> Atualizado ao final de cada sessão. É a primeira leitura obrigatória de toda sessão.

## Última sessão: 07 — 2026-09-02 (relatório: docs/relatorios/sessao-07.md)

## Pronto e testado (195 testes: 73 unitários API + 71 e2e API + 51 unitários web/contrato)

**A Fase 1A está funcionalmente completa em código.** Backend, site do cliente,
painel de produção e painel administrativo existem e passam nos testes. O que falta
para declarar a fase pronta é execução em ambiente real, não código — ver pendências.

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
- #1–#30 em docs/decisoes/. Sessão 04: app único (021), App Router (022), Zustand
  (023), contrato Zod (024). Sessão 05: token em localStorage (025), shadcn/ui (026),
  intervalo do alerta por dispositivo (027), PWA agora e Web Push depois (028),
  catálogo de rotas por caso de uso (029) só no site (030).

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
- **Nunca foi executado ponta a ponta contra o Mercado Pago real.** Falta criar as
  credenciais e validar a assinatura do webhook no sandbox (risco nº 1 desde a
  sessão 02). Enquanto isso não acontecer, a frase-teste da seção 2.2 não foi
  verificada de verdade.
- **Nenhuma verificação manual de interface.** Alerta sonoro em cozinha barulhenta,
  Wake Lock, PWA no celular real da loja e notificação em iOS dependem dos aparelhos
  (plano de testes 14.3). Nada disso é coberto por teste automatizado.
- **Não há dados reais.** Cardápio, categorias, adicionais, horários, regiões e
  usuários da loja precisam ser cadastrados (próximos passos 4 a 6 do PDF).

### Verificar com o Mercado Pago antes do deploy
- **Limites de recebimento da Conta Negócio pessoa física.** Confirmar com o suporte
  quais são os tetos de recebimento e se há retenção — o volume da loja não pode
  esbarrar num limite descoberto depois de a operação começar.
- **Prazo real do QR Pix.** O `createCheckout` não envia expiração ao gateway, então
  vale o padrão do Mercado Pago. Os 15 minutos da decisão #34 são a regra do NOSSO lado;
  se o padrão deles divergir, alinhar.
- **Número de saltos de proxy do provedor**, para preencher `TRUST_PROXY_HOPS`. Com o
  valor errado o rate limiting vira limite global e derruba a loja inteira.

### Decisões pendentes do usuário
- **Perfil de três telas:** `GET /orders`, `GET /menu/catalog` e "painéis ativos"
  foram implementados como gerente+; o PDF 5.7 não fixa o perfil. Confirmar.
- **Web Push** (decisão #28 adiou): fazer depois de verificar o aparelho real.
- **Projeto dentro do OneDrive.** 21.382 arquivos do `node_modules` viraram
  placeholders em nuvem e quebraram `tsc` e `next build` na sessão 04. Contornado com
  reinstalação e `attrib +P -U /S /D`, mas **vai reincidir**. A solução definitiva é
  mover o repositório para fora do OneDrive.

### Cortado de propósito — não voltar como pendência (decisão #31)
- **Isolar o gateway atrás de interface/porta:** avaliado e cortado. É higiene de
  código, não previne perda de dinheiro; o SDK já está encapsulado em `gateway.ts`.
- **`print_job` e qualquer infraestrutura de impressão:** Fase 2. `printedAt`/
  `printCount` continuam nulos e sem lógica. **Não será reintroduzido.**
- **Redis, BullMQ, WebSocket, fila em processo separado:** Fase 2. Consequência aceita:
  os contadores do rate limiting vivem em memória e zeram no reinício.

### Menores
- Intervalo/janela da reconciliação são constantes (60s / 5 min); a expiração usa
  `ORDER_EXPIRY_MINUTES` (25) em `src/common/order-expiry.ts`.
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

## Próximo passo concreto (sessão 08)
1. **Testar contra o sandbox do Mercado Pago** — é o único item que ainda bloqueia
   declarar a Fase 1A pronta. Checklist de prontidão no relatório da sessão 07.
2. Confirmar as decisões pendentes acima (perfis das três telas).
3. Cadastrar o cardápio real e os usuários da loja; executar o plano de testes da
   seção 14 nos aparelhos reais, com atenção às seções 14.2 e 14.3.
4. Só então: publicação (Vercel + backend), HTTPS, monitoramento e backup.
