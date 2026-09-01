# DECISÃO #28 — Alerta no celular com tela apagada: Web Push agora ou depois

**Data:** 2026-09-01 (sessão 04)

**Contexto:** há tensão dentro do próprio PDF. A seção 5.6 marca "alerta no celular:
notificação com som, funcionando com a tela apagada" como 1A — o que exige Web Push
completo (service worker, chaves VAPID, tabela de inscrições, envio no `order.paid`).
A seção 8.1 descreve o celular como "o mesmo painel, layout adaptado". A seção 8.5
registra que em iOS a notificação por navegador "precisa ser verificado no aparelho
real da loja antes de contar com esse canal".

## Opção A — PWA instalável agora, Web Push numa etapa própria
- Prós: entrega o painel completo já; o celular roda o painel com som armado e Wake
  Lock; permite testar no aparelho real antes de investir no push.
- Contras: com o app fechado o celular não alerta — mitigado pelo alerta redundante
  por WhatsApp da Fase 1B (seção 8.4).

## Opção B — Web Push junto com o painel
- Prós: cobre a tela apagada de imediato.
- Contras: puxa backend novo (VAPID, inscrições, envio) para dentro desta sessão, e
  o comportamento em iOS não pode ser validado sem o aparelho da loja.

**Recomendação:** A — o elo da frase-teste (2.2) é "a loja é alertada, vê o pedido na
tela e o aceita", e o painel com som cumpre isso. Push é reforço.
**Custo de reverter:** baixo — Web Push entra como consumidor adicional do mesmo
evento, sem tocar o painel.

## Resposta do usuário
> "A — PWA agora, Push depois"

**Resultado:** nesta etapa o painel é PWA instalável (manifest + ícones), com som
armado por clique, repetição até o aceite e Wake Lock. Web Push fica registrado como
pendência explícita, a ser feito depois de verificar o aparelho real da loja.
