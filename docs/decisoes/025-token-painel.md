# DECISÃO #25 — Onde guardar o token de autenticação do painel

**Data:** 2026-09-01 (sessão 04)

**Contexto:** a API autentica com JWT via `POST /auth/login` e espera
`Authorization: Bearer` em cada rota protegida. O painel fica aberto o expediente
inteiro no PC e no celular da loja, com polling de 5–10s e heartbeat de 30s.

## Opção A — `localStorage` + header `Authorization`
- Prós: funciona com a API exatamente como ela está; polling e heartbeat chamam a
  API direto do navegador, sem camada intermediária.
- Contras: um XSS no painel consegue ler o token (JWT vive 12h).

## Opção B — Cookie `httpOnly` via rotas proxy no Next
- Prós: o token nunca fica acessível ao JavaScript.
- Contras: toda chamada do painel passa por uma rota proxy no servidor Next,
  inclusive o polling — código novo e latência no caminho mais quente.

**Recomendação:** A.
**Custo de reverter:** médio — trocar depois significa introduzir a camada de proxy.

## Resposta do usuário
> "A — localStorage + Bearer"

**Resultado:** token em `localStorage` sob a chave `lanchonete.panel.token`,
enviado no header `Authorization: Bearer`. A autorização REAL continua sendo
verificada no servidor em toda rota (seção 12.2) — o front esconder um botão
nunca é controle de acesso.
