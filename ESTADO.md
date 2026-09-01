# ESTADO DO PROJETO
> Atualizado ao final de cada sessão. É a primeira leitura obrigatória de toda sessão.

## Última sessão: 05 — 2026-09-01 (relatórios: docs/relatorios/sessao-04.md e sessao-05.md)

## Pronto e testado (164 testes: 70 unitários API + 55 e2e API + 39 unitários web)

**A Fase 1A está funcionalmente completa em código.** Backend, site do cliente,
painel de produção e painel administrativo existem e passam nos testes. O que falta
para declarar a fase pronta é execução em ambiente real, não código — ver pendências.

### Backend (`apps/api`, sessões 01–03, ajustes na 04–05)
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

### Decisões pendentes do usuário
- **Perfil de três telas:** `GET /orders`, `GET /menu/catalog` e "painéis ativos"
  foram implementados como gerente+; o PDF 5.7 não fixa o perfil. Confirmar.
- **Web Push** (decisão #28 adiou): fazer depois de verificar o aparelho real.
- **Projeto dentro do OneDrive.** 21.382 arquivos do `node_modules` viraram
  placeholders em nuvem e quebraram `tsc` e `next build` na sessão 04. Contornado com
  reinstalação e `attrib +P -U /S /D`, mas **vai reincidir**. A solução definitiva é
  mover o repositório para fora do OneDrive.

### Menores
- Intervalo/janela da reconciliação são constantes (60s / 5 min).
- `npm audit`: 3 high no CLI do Prisma (dev-only) — risco aceito (sessão 02).
- Ao recriar `node_modules`, rodar `npm run prisma:generate -w apps/api` antes de
  compilar a API — sem isso o build falha com "@prisma/client has no exported member".

## Como rodar localmente
Passo a passo em **docs/como-testar.md** (verificado de ponta a ponta em 2026-09-01).
Portas: **API 3001**, **site 3000**. Ferramentas de desenvolvimento em
`apps/api/scripts/`: `seed:dev` (cardápio e horários de exemplo), `create:user`
(primeiro acesso ao painel) e `simulate:payment` (marca um pedido como pago para
exercitar o painel sem credenciais do gateway — não substitui o webhook real).

## Próximo passo concreto (sessão 06)
1. Confirmar as decisões pendentes acima (perfis das três telas).
2. Criar as credenciais do Mercado Pago e validar o fluxo pagamento → webhook →
   `order.paid` → alerta no painel contra o sandbox real.
3. Cadastrar o cardápio real e os usuários da loja; executar o plano de testes da
   seção 14 nos aparelhos reais, com atenção às seções 14.2 e 14.3.
4. Só então: publicação (Vercel + backend), HTTPS, monitoramento e backup.
