# DECISÃO #19 — Fluxo de status para pedido de retirada

**Data:** 2026-08-29 (sessão 03)

**Contexto:** o PDF define `aceito → em_preparo → pronto → a_caminho → concluido`, mas
não trata a retirada no balcão, onde "a caminho" não faz sentido. Necessário para o
endpoint de avanço de status do painel.

## Opção A — Fluxo depende do tipo de entrega
Retirada: `pronto → concluido` (pula `a_caminho`). Entrega: sequência completa.
- Prós: cliente de retirada nunca vê status falso; transições validadas por tipo.
- Contras: duas sequências para testar.

## Opção B — Fluxo único (retirada também passa por `a_caminho`)
- Prós: uma sequência.
- Contras: status mentiroso no acompanhamento do cliente.

**Recomendação:** A.
**Custo de reverter:** baixo — tabela de transições, sem migração.

## Resposta do usuário
> "A para todos"

**Resultado:** transições avançam um passo por vez, validadas por tipo de entrega em
função pura (`status-flow.ts`). O aceite continua exclusivo do endpoint de aceite.
