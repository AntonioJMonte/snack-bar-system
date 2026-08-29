# ESTADO DO PROJETO
> Atualizado ao final de cada sessão. É a primeira leitura obrigatória de toda sessão.

## Última sessão: 03 — 2026-08-29 (relatório: docs/relatorios/sessao-03.md)

## Pronto e testado (115 testes: 70 unitários + 45 e2e, tudo verde)
**O backend da Fase 1A está funcionalmente completo.** Sobre a base das sessões 01–02
(pedido com valores congelados, pagamento MP com webhook idempotente + `order.paid`,
auth JWT/argon2, operações de gerente auditadas), a sessão 03 entregou:
- Painel de produção completo: lista ativa (só pagos), aceite explícito (quem/quando),
  avanço de status por tipo de entrega (retirada pula `a_caminho` — decisão #19),
  heartbeat por usuário+dispositivo, painéis ativos p/ gerente+.
- Reconciliação agendada (60s, pendentes de 5+ min, `@nestjs/schedule` — decisão #18),
  desligada em teste; e2e cobre o método.
- Cadastro de cardápio + cardápio público `GET /menu`; horários (PUT semana) e regiões.
- Usuários (admin: criar/editar/desativar, argon2id, e-mail único) e `GET /audit`.
- Acompanhamento público `GET /orders/:id/tracking` (UUID não enumerável, sem vazar
  dados operacionais).

## Decisões tomadas
- #1–#20 em docs/decisoes/. Sessão 03: scheduler (018), fluxo de status na retirada
  (019), fechar backend antes do web (020).

## Pendências e bloqueios
- **Validar assinatura do webhook contra sandbox real do Mercado Pago** quando o
  usuário criar as credenciais (risco nº 1 desde a sessão 02).
- Intervalo/janela da reconciliação são constantes (60s / 5 min) — promover a config
  se a operação pedir.
- Painéis ativos visíveis a gerente+ (5.7 não fixa perfil) — confirmar com o usuário.
- `npm audit`: 3 high no CLI do Prisma (dev-only) — risco aceito (sessão 02).

## Próximo passo concreto (sessão 04)
1. Iniciar `apps/web` (Next.js 10.2 do PDF: Tailwind+shadcn/ui, TanStack Query,
   mobile-first): cardápio → carrinho → checkout (nome/telefone) → gateway →
   acompanhamento. Apresentar decisões de frontend em blocos (Regra de Ouro) antes
   de escolher libs/estrutura.
2. Depois do site do cliente: painel de produção web (som armado por clique, repetição
   até aceite, Wake Lock, PWA) e painel admin.
