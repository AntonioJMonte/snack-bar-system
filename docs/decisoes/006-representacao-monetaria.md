# DECISÃO #6 — Representação monetária

**Data:** 2026-08-29 (sessão 01)
Corresponde ao item 5 da lista da Etapa 2 do prompt.

**Contexto:** vale para banco, cálculo e API. A seção 11 do PDF proíbe ponto flutuante
e admite inteiro em centavos ou Decimal do banco. Afeta percentual de desconto, soma de
adicionais e conferência do valor contra o gateway.

## Opção A — Inteiro em centavos (`INTEGER` no Postgres, `number` inteiro no TS)
- Prós: aritmética exata nativa em JS até 2^53, sem biblioteca; comparação com gateway
  é comparação de inteiros; JSON sem ambiguidade; o único ponto delicado (percentual) é
  onde a decisão #7 define a regra única.
- Contras: `1990` = R$ 19,90 no banco; conversão para exibição na borda do frontend.

## Opção B — `DECIMAL(10,2)` + `Prisma.Decimal`
- Prós: legível no banco.
- Contras: toda aritmética via API da lib; `Number(x)` acidental reintroduz float
  silenciosamente; serializa como string no JSON.

**Recomendação:** A.
**Custo de reverter:** alto — migração de todas as colunas monetárias + reescrita de
todo cálculo.

## Resposta do usuário
> "Para todas as decisões vamos de opção A"

**Resultado:** inteiro em centavos em todo o sistema. Conversão para reais só na
exibição (frontend) e no ponto único de integração com o gateway.
