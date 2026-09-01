# DECISÃO #23 — Estado do carrinho no site do cliente

**Data:** 2026-09-01 (sessão 04)

**Contexto:** o carrinho vive só no navegador (o servidor recalcula tudo no checkout —
regra inegociável 5.4/3) e precisa sobreviver a recarregamento de página. A escolha
define se entra uma dependência nova (Regra de Ouro: não instalar lib sem perguntar).

## Opção A — Zustand
Lib de ~1 kB com middleware `persist` (localStorage).
- Prós: código mínimo, seletores sem re-render desnecessário, persistência pronta e
  testada; padrão de mercado para exatamente este caso.
- Contras: uma dependência nova.

## Opção B — React Context + `useReducer`
Persistência manual em localStorage.
- Prós: zero dependência.
- Contras: mais código próprio (persistência, hidratação SSR-safe, seletores) — mais
  superfície para bug num fluxo que envolve dinheiro.

**Recomendação:** A — menos código próprio em área sensível compensa a dependência
minúscula.
**Custo de reverter:** baixo — o estado do carrinho é isolado; trocar a implementação
não toca o resto.

## Resposta do usuário
> "A — Zustand"

**Resultado:** Zustand com `persist` em localStorage, apenas para o carrinho do site.
