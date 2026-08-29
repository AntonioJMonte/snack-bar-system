# DECISÃO #7 — Regra de arredondamento do desconto percentual

**Data:** 2026-08-29 (sessão 01)
Corresponde ao item 6 da lista da Etapa 2 do prompt.

**Contexto:** a seção 5.4 exige regra única, idêntica em todos os canais. Duas
dimensões: modo de arredondamento e ponto de aplicação. O modelo de dados (seção 11)
grava valores UNITÁRIOS congelados, o que restringe as opções.

## Opção A — Half-up por unidade
`discountAmountUnit = roundHalfUp(fullPriceUnit × percent)`;
`netPriceUnit = fullPriceUnit − discountAmountUnit`; linha = `netPriceUnit × qty`.
- Prós: valor líquido unitário é inteiro exato em centavos, como a seção 11 exige;
  a linha fecha sempre sem resíduo; half-up é o arredondamento comercial esperado;
  total do pedido = soma das linhas, sem ajuste.
- Contras: em quantidades grandes, o desconto total pode divergir centavos de
  "percentual sobre o total" — divergência determinística e documentável.

## Opção B — Half-up no total da linha
- Prós: agregado mais próximo do matemático.
- Contras: o líquido unitário deixa de ser representável em centavos exatos — conflita
  com os campos unitários congelados da seção 11.

**Recomendação:** A.
**Custo de reverter:** alto — muda valores cobrados; irreversível retroativamente após
pedidos reais.

## Resposta do usuário
> "Para todas as decisões vamos de opção A"

**Resultado:** half-up (meio-para-cima), aplicado por unidade, implementado como função
pura única usada por todos os canais. Adicionais somam ao valor cheio unitário ANTES da
aplicação do percentual (seção 5.4).
