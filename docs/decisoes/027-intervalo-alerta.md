# DECISÃO #27 — Como tornar configurável o intervalo do alerta sonoro

**Data:** 2026-09-01 (sessão 04)

**Contexto:** a seção 8.2 exige que o som toque "a cada 15 a 20 segundos
(intervalo configurável)" enquanto houver pedido não aceito, mas não diz por quem
nem onde se configura. Ambiguidade na documentação é decisão.

## Opção A — Constante no código (15s)
- Prós: mais simples; atende a faixa.
- Contras: mudar exige deploy — o "configurável" da seção 8.2 não se cumpre.

## Opção B — Por dispositivo, em `localStorage`, ajustável na tela do painel
- Prós: o PC da cozinha e o celular do dono podem ter intervalos diferentes; a loja
  ajusta sozinha; nenhuma mudança no backend.
- Contras: a configuração não é centralizada — cada dispositivo tem a sua.

**Recomendação:** B.
**Custo de reverter:** baixo.

## Resposta do usuário
> "B — Por dispositivo em localStorage"

**Resultado:** intervalo por dispositivo em `localStorage`
(`lanchonete.panel.alertInterval`), padrão 15s, ajustável na tela do painel dentro
da faixa de 15 a 20 segundos da seção 8.2.
