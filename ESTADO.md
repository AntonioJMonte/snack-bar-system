# ESTADO DO PROJETO
> Atualizado ao final de cada sessão. É a primeira leitura obrigatória de toda sessão.

## Última sessão: 01 — 2026-08-29 (relatório: docs/relatorios/sessao-01.md)

## Pronto e testado
- Monorepo npm workspaces; `apps/api` (NestJS 11.2, Prisma 6.19, Zod 4.5, Vitest 4.1).
- Docker Compose `postgres:17` com bancos `lanchonete_dev` e `lanchonete_test`.
- Configuração de ambiente validada com Zod — app não sobe sem variável (comprovado).
- Schema Prisma completo (seção 11 + DeliveryRegion + StoreSchedule), 2 migrações
  aplicadas; CHECKs de desconto 0–100 e quantidade > 0 garantidos pelo banco.
- `POST /orders` completo: validação (telefone BR/DDD, endereço só na entrega),
  disponibilidade, loja aberta (manual > programado), cálculo no servidor com três
  valores congelados por item (half-up por unidade, centavos inteiros), transação
  única, log de rastreabilidade. Erros com códigos específicos.
- 53 testes unitários + 2 e2e (HTTP + banco descartável) verdes; typecheck e build OK.

## Em andamento
- Nada pendurado: a sessão fechou com a fatia vertical completa.

## Decisões tomadas
- #1–#14 em docs/decisoes/ (uma por arquivo, com a resposta do usuário). Destaques:
  identificadores em INGLÊS com glossário (004), dinheiro em centavos inteiros (006),
  half-up por unidade (007), UUID v7 (009), UTC + STORE_TIMEZONE (013),
  status inicial `pending_payment` (014).

## Pendências e bloqueios
- Consentimento Prisma embutido no e2e (`test/global-setup.ts`) — validar com o usuário
  se a abordagem está OK (ver risco 1 do relatório da sessão 01).
- Gateway de pagamento ainda não decidido (Mercado Pago vs Stripe) — decisão da
  sessão 02, via Regra de Ouro.
- Expiração "fim do dia" da sobreposição manual: leitura pronta, escrita (cálculo do
  expiresAt no fuso da loja) entra com o endpoint do gerente.

## Próximo passo concreto (sessão 02)
1. e2e dos caminhos de erro (esgotado, loja fechada, adicional inválido).
2. DECISÃO: gateway de pagamento. Depois: intenção de pagamento + webhook idempotente
   + conferência de valor + publicação única do evento `order.paid`.
3. Endpoints de gerente com guards por perfil + auditoria + expiresAt no fuso da loja.
