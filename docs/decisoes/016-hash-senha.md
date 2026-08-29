# DECISÃO #16 — Algoritmo de hash de senha

**Data:** 2026-08-29 (sessão 02)

**Contexto:** seção 12.2 exige hash forte; necessário para os usuários dos três perfis.

## Opção A — Argon2id (lib `argon2`)
- Prós: recomendação OWASP atual; resistente a GPU/ASIC por custo de memória.
- Contras: dependência nativa (prebuilds disponíveis).

## Opção B — bcrypt (`bcryptjs`)
- Prós: maduro, JS puro.
- Contras: mais fraco em hardware moderno; limite de 72 bytes.

**Recomendação:** A.
**Custo de reverter:** baixo — re-hash no próximo login.

## Resposta do usuário
> "opção A para todas"

**Resultado:** Argon2id via lib `argon2`, parâmetros padrão da lib.
