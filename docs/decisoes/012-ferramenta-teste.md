# DECISÃO #12 — Ferramenta de teste e organização dos arquivos

**Data:** 2026-08-29 (sessão 01)
Corresponde ao item 11 da lista da Etapa 2 do prompt.

**Contexto:** vale para unitários e e2e do backend (e depois do frontend).

## Opção A — Vitest; unitários `*.spec.ts` ao lado do código; e2e em `test/` do app
- Prós: execução muito mais rápida (sem ts-jest); API compatível com Jest; mesma
  ferramenta servirá o Next.js depois; colocation mantém teste e regra juntos.
- Contras: scaffold NestJS vem com Jest — troca de config manual única. NestJS usa
  `emitDecoratorMetadata`, que o esbuild do Vitest não suporta — exige o plugin SWC
  (`unplugin-swc` + `@swc/core`) na config do Vitest.

## Opção B — Jest (padrão NestJS)
- Prós: pronto no scaffold; mais exemplos na documentação NestJS.
- Contras: lento em TypeScript; ESM doloroso; ferramenta diferente do frontend.

**Recomendação:** A.
**Custo de reverter:** baixo — API compatível.

## Resposta do usuário
> "Opção A para todas as decisões"

**Resultado:** Vitest com plugin SWC; `*.spec.ts` colocalizados; e2e em `apps/api/test/`.
