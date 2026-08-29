# DECISÃO #15 — Gateway de pagamento

**Data:** 2026-08-29 (sessão 02)

**Contexto:** define checkout, formato/assinatura do webhook e reconciliação. O PDF
(10.3) recomenda Mercado Pago; Pix é o método principal.

## Opção A — Mercado Pago
- Prós: melhor cobertura de Pix no BR; Checkout Pro mantém cartão no ambiente do
  gateway; webhooks assinados (`x-signature`); conta/liquidação locais.
- Contras: docs/SDK menos polidos; sandbox instável às vezes.

## Opção B — Stripe
- Prós: melhor DX do mercado.
- Contras: Pix limitado no BR; taxas/liquidação piores; contraria o PDF.

**Recomendação:** A.
**Custo de reverter:** médio-alto — integração isolada no módulo `payments`.

## Resposta do usuário
> "opção A para todas"

**Resultado:** Mercado Pago, com SDK oficial `mercadopago` encapsulado num client
próprio (permite testes sem credenciais). Métodos habilitados no checkout: Pix,
crédito e débito.
