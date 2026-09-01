# Sessão 04 — Contrato compartilhado e site do cliente

**Data:** 2026-09-01
**Frente:** início da `apps/web` (Fase 1A), conforme decisão #20.

## Decisões tomadas

| # | Tema | Resultado |
|---|---|---|
| 21 | Estrutura do frontend | App único `apps/web` com `/` (cliente), `/painel`, `/admin` |
| 22 | Roteador do Next.js | App Router |
| 23 | Estado do carrinho | Zustand com `persist` em localStorage |
| 24 | Contrato web↔API | Pacote `packages/contracts` com schemas Zod compartilhados |

Todas registradas em `docs/decisoes/`, com a resposta do usuário anotada.

## O que foi entregue

### `packages/contracts` (`@lanchonete/contracts`)

Novo workspace, previsto desde a decisão #2 (`packages/*` já estava em
`workspaces`). Contém:

- **Schemas Zod de request e response** para menu, loja, pedido, pagamento,
  auth e painel — a mesma definição valida no servidor e no navegador.
- **As duas funções puras que são regra de negócio única:** `priceUnit` /
  `unitDiscountCents` (arredondamento half-up por unidade, decisão #7) e
  `normalizeBrazilianPhone` (seção 5.3).

A consequência prática: o preço exibido no carrinho sai da **mesma função** que
grava o pedido no banco. Não há segunda implementação de arredondamento.

### Refatoração da API (sem mudança de comportamento)

Três arquivos viraram reexports do pacote, preservando todos os imports e testes
existentes:

- `src/orders/domain/pricing.ts`
- `src/common/phone.ts`
- `src/orders/dto/create-order.schema.ts`

Além disso: variável `WEB_ORIGIN` no `env.ts`, CORS restrito a essa origem no
`main.ts`, e `back_urls` na preferência do Mercado Pago apontando para o
acompanhamento do pedido. O comentário no `gateway.ts` deixa explícito que esse
retorno é **navegação apenas** — a prova de pagamento continua sendo só o
webhook assinado (seção 5.3).

### `apps/web` — site do cliente

Next.js 16 (App Router), Tailwind CSS 4, TanStack Query, Zustand.

- **`/` — cardápio:** renderizado no servidor (PDF 10.2). Busca por nome, filtro
  por categoria, item esgotado sinalizado e não clicável, item com desconto
  exibindo o valor cheio riscado ao lado do valor líquido (seção 5.1). Aviso de
  loja fechada com o horário programado.
- **Personalização do item:** adicionais, observação livre e quantidade. Os
  adicionais somam ao valor cheio **antes** do desconto (seção 5.4).
- **`/carrinho` — carrinho e checkout:** ajuste de quantidade, remoção, nome e
  telefone obrigatórios, escolha entre retirada e entrega, endereço e região
  apenas na entrega. O resumo mostra a estrutura da seção 5.4 (subtotal cheio,
  total de descontos, subtotal líquido, taxa de entrega, total). O payload
  enviado carrega **apenas** item, quantidade, adicionais e observação — nenhum
  preço, desconto ou total.
- **`/pedido/[id]` — acompanhamento:** consulta periódica de 10s, linha do tempo
  por tipo de entrega (na retirada não existe "a caminho", decisão #19), e
  rótulos que não expõem estado operacional interno (`awaiting_acceptance` e
  `accepted` aparecem ambos como "Recebido").

O mapeamento de erros de domínio (`STORE_CLOSED`, `ITEM_SOLD_OUT`,
`REGION_INACTIVE`, …) traduz cada código para uma mensagem ao cliente, e os
erros que invalidam o carrinho oferecem o caminho de volta ao cardápio.

## Testes

| Suíte | Quantidade | Situação |
|---|---|---|
| API — unitários | 70 | verdes |
| API — e2e | 45 | verdes |
| Web — unitários | 23 | verdes |
| **Total** | **138** | |

Os 23 testes novos cobrem a formatação de dinheiro (incluindo o caso clássico de
"R$ 12,3" perdendo o zero final), a matemática do carrinho (desconto de 15% e de
100%, adicionais antes do desconto, half-up por unidade multiplicado depois pela
quantidade) e a linha do tempo do acompanhamento.

## Incidente de ambiente resolvido

O `tsc` e o `next build` falharam com `File 'lib.dom.d.ts' not found` e
`UNKNOWN: unknown error, read` (errno -4094). Causa: o repositório vive dentro
do OneDrive, e **21.382 arquivos do `node_modules` haviam virado placeholders em
nuvem** — a hidratação sob demanda expirava e o Node não conseguia ler os
arquivos.

Correção aplicada: `node_modules` removido e reinstalado (arquivos novos nascem
locais) e a árvore fixada com `attrib +P -U /S /D` para o OneDrive mantê-la
sempre disponível offline. Build e typecheck passaram em seguida.

**Isso vai voltar a acontecer** enquanto o projeto estiver dentro do OneDrive —
está registrado como pendência.

## Pendências abertas

- **shadcn/ui não foi adotado.** O PDF (10.2) o nomeia, mas ele exige uma CLI
  interativa e traz dependências próprias (clsx, tailwind-merge, cva,
  lucide-react). Os componentes foram escritos em Tailwind puro, com um helper
  `cn()` de assinatura compatível e tokens em variáveis CSS, para que adotá-lo
  depois seja aditivo. **Precisa de decisão.**
- **Painel de produção e painel admin não foram iniciados.** Dependem de decidir
  onde guardar o token de autenticação, entre outras escolhas.
- Herdadas: validar a assinatura do webhook contra o sandbox real do Mercado
  Pago; intervalo da reconciliação como constante; perfil que vê "painéis
  ativos"; 3 vulnerabilidades high no CLI do Prisma (dev-only).
- A suíte e2e completa teve um timeout de hook no sétimo arquivo
  (`panel.e2e-spec.ts`) por exaustão da máquina; o arquivo passa isolado em 8,9s.
  Não é regressão, mas a suíte é lenta neste hardware.
