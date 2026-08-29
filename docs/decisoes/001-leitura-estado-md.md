# DECISÃO #1 — Como garantir que ESTADO.md seja lido no início de cada sessão

**Data:** 2026-08-29 (sessão 01)

**Contexto:** O `CLAUDE.md` é injetado automaticamente em toda sessão; o `ESTADO.md`
não é. Se ele não for lido, uma sessão futura pode retrabalhar ou contradizer o estado
real do projeto.

## Opção A — Instrução imperativa no topo do CLAUDE.md
- Prós: zero configuração; visível e editável; instrução em destaque no CLAUDE.md é
  respeitada de forma confiável pelo modelo.
- Contras: é instrução ao modelo, não garantia mecânica do harness.

## Opção B — Hook SessionStart em `.claude/settings.json`
- Prós: garantia mecânica — o harness executa o hook e injeta o conteúdo do ESTADO.md
  no contexto, sem depender de obediência do modelo.
- Contras: mais uma peça de configuração; ESTADO.md grande inflaria o contexto de toda
  sessão.

**Recomendação:** B, mantendo A como redundância barata.
**Custo de reverter:** baixo — meia dúzia de linhas de configuração.

## Resposta do usuário
> "pode ser ambas as opções"

**Resultado:** implementadas as duas — instrução no topo do CLAUDE.md + hook
SessionStart que faz `cat ESTADO.md` e injeta a saída no contexto.
