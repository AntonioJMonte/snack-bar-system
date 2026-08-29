# DECISÃO #4 — Idioma dos identificadores (código e banco)

**Data:** 2026-08-29 (sessão 01)

**Contexto:** o documento define a linguagem do domínio em português (`pedido.pago`,
`aguardando_aceite`, valor cheio/líquido). Nomes de tabela, coluna, classe e evento
derivam disso. Precisa ser um idioma só; decisão cara de trocar.

## Opção A — Português para o domínio
- Prós: correspondência 1:1 com a especificação; zero risco de tradução ambígua.
- Contras: mistura visual com inglês do ecossistema; acentos exigem convenção.

## Opção B — Inglês em tudo, com glossário de tradução
- Prós: convenção dominante do ecossistema; código exportável como portfólio.
- Contras: cada termo do PDF precisa de tradução mantida em glossário; código descola
  da especificação.

**Recomendação:** A.
**Custo de reverter:** alto — renomear tabelas, API e eventos após existir dado.

## Resposta do usuário
> "Decisões 4 e 5 seguem as opções B"

**Resultado:** identificadores em INGLÊS em código, banco, API e eventos. Contra a
recomendação, por escolha explícita do usuário. Consequência obrigatória: manter o
glossário abaixo atualizado (fonte: PDF v3.1) e usá-lo de forma consistente.

## Glossário PDF → código (inicial; ampliar conforme necessário)
| PDF (pt) | Código (en) |
|---|---|
| pedido | order |
| item do pedido | order item |
| evento `pedido.pago` | event `order.paid` |
| valor cheio | full price / `fullPrice` |
| desconto aplicado (percentual e valor) | `discountPercent`, `discountAmount` |
| valor líquido | net price / `netPrice` |
| cardápio / item / categoria / adicional | menu / item / category / add-on (`addon`) |
| esgotado | sold out (`soldOut`) |
| retirada / entrega | pickup / delivery |
| taxa de entrega | delivery fee |
| loja aberta/fechada; sobreposição manual | store open/closed; manual override |
| aguardando_aceite / aceito | `awaiting_acceptance` / `accepted` |
| em_preparo / pronto / a_caminho / concluido | `preparing` / `ready` / `out_for_delivery` / `completed` |
| atendente / gerente / administrador | `attendant` / `manager` / `admin` |
| auditoria | audit log |
| estado da loja | store status |
| conversa WhatsApp | whatsapp conversation |
| sessão de painel | panel session |
| impresso_em / impressoes | `printedAt` / `printCount` |
