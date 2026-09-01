# DECISÃO #22 — Roteador do Next.js

**Data:** 2026-09-01 (sessão 04)

**Contexto:** o PDF fixa Next.js (React + TypeScript) com renderização no servidor
para o cardápio (10.2). O Next.js oferece dois roteadores. A versão exata (major
estável mais recente no momento da instalação) é pinada e anotada aqui, como na
decisão #5.

## Opção A — App Router
Padrão atual do Next.js, Server Components.
- Prós: caminho recomendado e documentado hoje; cardápio renderizado no servidor por
  padrão (exigência do PDF 10.2); shadcn/ui e TanStack Query têm integração de
  primeira classe.
- Contras: modelo mental mais novo (Server vs Client Components).

## Opção B — Pages Router
Modelo clássico.
- Prós: mais quilometragem histórica, modelo único de componente.
- Contras: modo legado — novos recursos e documentação priorizam o App Router; SSR
  exige `getServerSideProps` manual.

**Recomendação:** A — é o padrão da ferramenta e atende o requisito de SSR do
cardápio sem esforço extra.
**Custo de reverter:** alto — migrar roteador depois é reescrever a camada de rotas.

## Resposta do usuário
> "A — App Router"

**Resultado:** App Router. Versões instaladas na sessão 04 anotadas abaixo após a
instalação.
