# DECISÃO #26 — shadcn/ui ou componentes próprios

**Data:** 2026-09-01 (sessão 04)

**Contexto:** o PDF (10.2) nomeia "Tailwind CSS com shadcn/ui". O site do cliente
da sessão 04 foi escrito em Tailwind puro com um helper `cn()` de assinatura
compatível, porque o shadcn exige CLI e traz dependências próprias. O painel admin
virá cheio de tabelas, diálogos, selects e formulários.

## Opção A — Adotar shadcn/ui agora
- Prós: segue o PDF; primitivas prontas e acessíveis exatamente onde o admin mais
  precisa; os componentes já escritos não precisam ser reescritos.
- Contras: quatro dependências novas (clsx, tailwind-merge,
  class-variance-authority, lucide-react).

## Opção B — Manter componentes próprios
- Prós: zero dependência nova; o que existe está funcionando.
- Contras: cada diálogo, select e tabela do admin escrito e testado à mão,
  acessibilidade inclusa.

**Recomendação:** A.
**Custo de reverter:** baixo — os componentes do shadcn ficam no repositório como
arquivos nossos.

## Resposta do usuário
> "A — Adotar shadcn/ui"

**Resultado:** dependências instaladas e `cn()` promovido à implementação canônica
(`clsx` + `tailwind-merge`). Componentes de UI ficam em `src/components/ui/`. As
telas do cliente escritas na sessão 04 continuam válidas — eram Tailwind puro com
a mesma assinatura de `cn()`.
