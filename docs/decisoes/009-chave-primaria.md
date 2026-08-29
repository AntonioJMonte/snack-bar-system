# DECISÃO #9 — Tipo de chave primária

**Data:** 2026-08-29 (sessão 01)
Corresponde ao item 8 da lista da Etapa 2 do prompt.

**Contexto:** PK interna de todas as entidades; aparece em URLs de API e no
rastreamento (seção 9.3). O número do pedido visível ao cliente é campo separado,
legível e sequencial.

## Opção A — UUID v7 (Prisma `@default(uuid(7))`, coluna `uuid` nativa)
- Prós: não enumerável (não expõe volume nem permite percorrer pedidos alheios);
  ordenado no tempo — indexa bem, sem a fragmentação do v4; gerável na aplicação antes
  do INSERT, útil para rastreabilidade dentro da transação.
- Contras: 16 bytes; ilegível em log — mitigado pelo número do pedido legível.

## Opção B — Inteiro sequencial
- Prós: pequeno, familiar.
- Contras: enumerável em endpoints públicos; expõe volume de vendas.

**Recomendação:** A (CUID resolveria o mesmo, mas fora do padrão SQL sem ganho).
**Custo de reverter:** médio-alto — trocar PK com FKs e dados é migração intrusiva.

## Resposta do usuário
> "Para todas as decisões vamos de opção A"

**Resultado:** UUID v7 como PK de todas as entidades; número do pedido legível como
campo próprio.
