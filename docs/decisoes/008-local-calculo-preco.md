# DECISÃO #8 — Onde mora o cálculo de preço

**Data:** 2026-08-29 (sessão 01)
Corresponde ao item 7 da lista da Etapa 2 do prompt.

**Contexto:** a seção 6.2 exige comportamento idêntico entre site e WhatsApp.

## Opção A — Serviço de domínio único (`PricingService` no módulo `orders`)
Consumido por qualquer canal na criação do pedido; canais nunca calculam nada.
- Prós: a exigência de comportamento idêntico é satisfeita por construção; testes num
  lugar só; Fase 1B reutiliza sem escrever cálculo.
- Contras: nenhum relevante.

## Opção B — Lógica replicada por canal
- Contras: divergência garantida com o tempo; viola a seção 6.2.

**Recomendação:** A (B contradiz a especificação; apresentada por transparência).
**Custo de reverter:** médio.

## Resposta do usuário
> "Para todas as decisões vamos de opção A"

**Resultado:** cálculo de preço centralizado em serviço de domínio único.
