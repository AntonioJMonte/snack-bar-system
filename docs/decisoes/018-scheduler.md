# DECISÃO #18 — Biblioteca de agendamento

**Data:** 2026-08-29 (sessão 03)

**Contexto:** reconciliação periódica (9.2) e, futuramente, expiração de carrinhos do
WhatsApp (1B). O PDF (10.1) indica "agendador nativo do NestJS".

## Opção A — `@nestjs/schedule`
- Prós: é o que o PDF especifica; integrado ao ciclo de vida do Nest; zero infra.
- Contras: mais uma dependência (leve, oficial).

## Opção B — `setInterval` manual
- Prós: sem dependência.
- Contras: fora do ciclo de vida; vaza em testes/shutdown.

**Recomendação:** A.
**Custo de reverter:** baixo.

## Resposta do usuário
> "A para todos"

**Resultado:** `@nestjs/schedule` instalado; reconciliação a cada 60s sobre pedidos
pendentes com mais de 5 minutos; desligada em ambiente de teste (os e2e chamam o
método diretamente).
