# Sistema de Pedidos para Lanchonete — Contexto Permanente

> **ANTES DE QUALQUER AÇÃO nesta sessão: leia `ESTADO.md` (raiz do repositório) com a
> ferramenta Read. Ele contém o estado real do projeto e o próximo passo. Não presuma
> nada sobre o que já existe sem tê-lo lido.**
> (Um hook SessionStart em `.claude/settings.json` também injeta o ESTADO.md
> automaticamente; esta instrução é a redundância caso o hook falhe.)

Fonte única de verdade: `sistema-pedidos-lanchonete-v3.1.pdf`. Em conflito, o PDF vence.

## Princípio central
O sistema de pedidos NÃO depende de impressora. Um pedido é válido, confirmado e
produzível assim que o pagamento é validado e persistido. Impressão é consumidora do
evento `pedido.pago`, jamais parte do caminho crítico.

## Critério de pronto da Fase 1 (frase-teste)
"Um cliente real abre o site no celular ou manda mensagem no WhatsApp, monta o pedido,
informa seu telefone, paga por Pix, e a loja é alertada, vê o pedido na tela e o aceita."
Se um recurso pode ser removido sem impedir que o cliente peça, pague e receba, não é Fase 1.

## Fronteira de fases
- **1A (atual):** banco, API, cálculo no servidor, pedido, pagamento+webhook, evento
  `pedido.pago`, painel de produção (polling 5–10s), painel admin, 3 perfis, auditoria.
- **1B:** WhatsApp Cloud API oficial (nunca lib não oficial), alerta redundante à loja.
- **2 — PROIBIDO implementar agora:** Redis, BullMQ, WebSocket, agente de impressão,
  tarefa de impressão, cupons de pedido inteiro, conta do cliente, relatórios.
  Se sentir necessidade de um deles, a fronteira foi violada — parar e avisar o usuário.

## Regras de negócio inegociáveis
1. **Congelamento (seção 5.4):** cada item do pedido grava na compra: valor cheio
   unitário, desconto (percentual E valor), valor líquido unitário, e o nome do item no
   momento da compra. Nunca recalculados. O cardápio muda; o histórico não.
2. **Total sempre do servidor:** preço/desconto/total vindos do cliente são IGNORADOS
   (não lidos), nunca usados. O servidor recalcula tudo a partir do cardápio.
3. **Telefone obrigatório** em todos os canais e ambos os tipos de entrega (inclusive
   retirada). Formato brasileiro válido com DDD, validado no servidor.
4. **Loja fechada:** validada no momento da CRIAÇÃO do pedido no servidor. Precedência:
   sobreposição manual (abrir/fechar do gerente) vence horário programado e expira ao
   final do dia, retornando ao automático.
5. **Auditoria obrigatória** (quem, quando, o quê, valor anterior, valor novo) para:
   alteração de preço, desconto, esgotado/disponível, abrir/fechar loja manual.
6. **Desconto por item:** 0–100%, restrição também no banco. Taxa de entrega nunca
   recebe desconto. Cupom de pedido inteiro é Fase 2.

## Matriz de permissões (verificada SEMPRE no servidor, nunca só na interface)
| Permissão | Atendente | Gerente | Admin |
|---|---|---|---|
| Painel, aceitar, avançar status, marcar esgotado | Sim | Sim | Sim |
| Alterar preço, desconto, cadastrar itens, abrir/fechar loja, horários/taxas, relatórios | Não | Sim | Sim |
| Usuários/perfis, credenciais/integrações, consultar auditoria | Não | Não | Sim |

## Requisitos não funcionais que afetam código
- **Dinheiro:** representação exata (decisão #5 em docs/decisoes/). Ponto flutuante é
  proibido em qualquer circunstância. Regra de arredondamento única (decisão #6),
  idêntica em todos os canais.
- **Idempotência:** id da transação do gateway é ÚNICO por restrição do banco. Um
  webhook duplicado = um pedido, um alerta. Processamento de webhook em transação.
- **Rastreabilidade (9.3):** todo pedido tem id registrado em cada etapa do ciclo.
- **Transacionalidade:** criação de pedido inteira dentro de uma transação.
- **Fase 2 a custo zero:** campos `impresso_em`/`impressoes` opcionais e nulos; nenhuma
  lógica os usa na Fase 1.

## Fronteira entre módulos (seção 13)
Nenhum módulo de canal (site, WhatsApp) e nenhum módulo de saída (painel) conhece outro
diretamente. Tudo se comunica pelo backend e pelo evento `pedido.pago`, publicado uma
única vez por pedido.

## Stack e versões (decisões #2–#13 em docs/decisoes/)
- Monorepo npm workspaces: `apps/api` (NestJS 11), `apps/web` (Next.js, sessão futura),
  futuro `apps/agent` (Fase 2). Node 24 LTS, Prisma 6, PostgreSQL 17, Zod, Vitest.
- Postgres local via Docker Compose: um container, bancos `lanchonete_dev` e
  `lanchonete_test`. Nada de Supabase/Railway em desenvolvimento.
- e2e: banco de teste recriado por execução, TRUNCATE entre testes, API via HTTP.

## Convenções de código
- **Identificadores em INGLÊS** (código, banco, API, eventos) — glossário obrigatório
  em docs/decisoes/004-idioma-identificadores.md. O evento `pedido.pago` do PDF chama-se
  `order.paid` no código.
- Backend por módulo de domínio: `menu/`, `orders/`, `payments/`, `store/`, `users/`,
  `audit/`, `panel/`. Cálculo de preço SOMENTE no `PricingService` (módulo orders).
- **Dinheiro: inteiro em centavos** (`Int` no Prisma, `number` inteiro no TS). Conversão
  para reais só na exibição e no ponto único de integração com o gateway.
- **Arredondamento: half-up, por unidade** — `unitDiscount = roundHalfUp(unitFull × %)`;
  `unitNet = unitFull − unitDiscount`; linha = `unitNet × qty`. Função pura única.
- PK: UUID v7 (`@default(uuid(7))`). Número do pedido visível = campo próprio sequencial.
- Datas: `timestamptz` (UTC) sempre; fuso da loja em `STORE_TIMEZONE` (IANA), aplicado
  por serviço único de calendário. Horário de funcionamento = hora local + dia da semana.
- Testes: Vitest (plugin SWC p/ decorators); unitários `*.spec.ts` colocalizados; e2e em
  `apps/api/test/`.

## REGRA DE OURO — vale para todas as sessões
Nenhuma decisão é tomada sem o usuário. Havendo mais de um caminho possível (nome,
biblioteca, formato, estrutura, estratégia), apresentar no formato:
DECISÃO #N — título / Contexto / Opção A (prós, contras) / Opção B (prós, contras) /
Recomendação com motivo / Custo de reverter (baixo-médio-alto e por quê) — e PARAR até
resposta explícita. Máximo 4 decisões por bloco; nenhuma avança sem resposta. Ambiguidade
na documentação também é decisão: não inventar, não deduzir. Registrar cada decisão
aprovada em docs/decisoes/ (uma por arquivo, com a resposta do usuário anotada).
Não instalar biblioteca sem perguntar. Não alterar teste que falha sem antes explicar.
Ao final de cada sessão: atualizar ESTADO.md e gerar docs/relatorios/sessao-NN.md.
