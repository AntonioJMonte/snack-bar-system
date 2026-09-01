# DECISÃO #21 — Estrutura do frontend: um app ou vários

**Data:** 2026-09-01 (sessão 04)

**Contexto:** a Fase 1A precisa de três superfícies web: site do cliente, painel de
produção (PWA com som) e painel admin. O PDF (10.5) hospeda "site e painéis" juntos
na Vercel. A fronteira da seção 13 exige apenas que canais e saídas não se conheçam —
ambos falam só com a API, o que é preservado nas duas opções.

## Opção A — Um único `apps/web`
Áreas por rota: `/` (cliente), `/painel` (produção), `/admin`.
- Prós: um deploy, um design system, reuso do cliente HTTP e componentes; menos
  configuração e manutenção — adequado à escala de uma lanchonete.
- Contras: exige disciplina para não vazar código de admin no bundle público
  (resolvível com route groups e imports separados); um deploy afeta as três áreas.

## Opção B — Apps separados
`apps/web` para o site, `apps/panel` para os painéis.
- Prós: isolamento total de código e deploys independentes.
- Contras: dois projetos Next para manter, config e componentes duplicados, dois
  deploys — custo alto para o benefício nesta escala.

**Recomendação:** A — a escala do negócio não justifica múltiplos apps, e a fronteira
arquitetural relevante (módulos só falam com o backend) fica intacta.
**Custo de reverter:** médio — extrair rotas para outro app depois é mecânico, mas
trabalhoso.

## Resposta do usuário
> "A — App único"

**Resultado:** um único `apps/web` Next.js com `/` (cliente), `/painel` (produção)
e `/admin`.
