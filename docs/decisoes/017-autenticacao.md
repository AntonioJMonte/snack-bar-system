# DECISÃO #17 — Mecanismo de autenticação dos painéis

**Data:** 2026-08-29 (sessão 02)

**Contexto:** login com três perfis; autorização verificada no servidor em toda rota
(12.2); poucos usuários, dispositivos fixos, PWA.

## Opção A — JWT curto (`@nestjs/jwt`), Bearer, guards por perfil
- Prós: padrão NestJS; sem estado; simples no PWA/polling; TTL de expediente.
- Contras: revogação antecipada exige trocar o segredo (derruba todos — aceitável).

## Opção B — Sessão em banco + cookie httpOnly
- Prós: revogação imediata.
- Contras: CSRF, estado e limpeza para o mesmo resultado.

**Recomendação:** A.
**Custo de reverter:** médio — troca a borda, não o domínio.

## Resposta do usuário
> "opção A para todas"

**Resultado:** JWT com TTL configurável (`JWT_TTL`, padrão 12h), segredo em
`JWT_SECRET`, guard de autenticação + guard de perfil com hierarquia
attendant < manager < admin.
