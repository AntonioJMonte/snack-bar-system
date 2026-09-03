# DECISÃO #31 — Escopo mínimo para fechar a Fase 1

**Data:** 2026-09-02 (sessão 07)

**Contexto:** as sessões anteriores buscavam robustez. Esta busca **término**. O sistema
atende uma lanchonete pequena, com volume baixo, e o objetivo passou a ser chegar ao
teste de webhook com credenciais de sandbox tendo resolvido apenas o essencial.

Mudança de critério definida pelo dono do projeto, não uma opção entre alternativas.

## Os quatro critérios

Só entra no escopo o que se enquadra em um destes:

1. **Evita perda de dinheiro** — pagamento não confirmado, pedido duplicado, pagamento
   que some do banco.
2. **Evita queda ou lentidão da aplicação.**
3. **Segurança básica** — limite de requisições, segredos protegidos, assinatura
   validada.
4. **Garante que o pagamento realmente ocorreu.**

**Se algo não se encaixa em um desses quatro, não se faz** — mesmo sendo boa prática.

## O que foi cortado, e por quê

Registrado aqui para não voltar como pendência fantasma em sessão futura.

| Cortado | Motivo |
|---|---|
| **Isolar o gateway atrás de interface/porta** | Higiene de código, não previne perda de dinheiro. Avaliado e cortado explicitamente pelo dono do projeto. O SDK já está encapsulado em `payments/gateway.ts` (decisão #15) e o resto do código nunca vê tipos do Mercado Pago — o ganho seria só de forma. |
| **Tabela `print_job` e qualquer infraestrutura de impressão** | Fase 2, e o princípio central diz que o pedido não depende de impressora. Os campos `printedAt`/`printCount` continuam existindo, opcionais e nulos, sem nenhuma lógica que os use. **Não será reintroduzido.** |
| **Redis, BullMQ, WebSocket, fila em processo separado** | Fase 2. O painel usa polling e o evento `order.paid` é emitido em processo. Consequência aceita: o rate limiting guarda contadores em memória e zera no reinício. |
| **Refatoração de arquitetura, DDD adicional, renomeação de módulos** | Nenhum dos quatro critérios. |
| **Testes além dos explicitamente pedidos** | Idem. |
| **Otimização de performance sem evidência de problema** | O tempo de resposta do webhook foi medido (23ms de média) justamente para não otimizar às cegas. |

## O que permanece decidido e não se reabre

- **Mercado Pago é o gateway definitivo.** Conta Negócio pessoa física, apenas CPF —
  nada que dependa de CNPJ.
- **`POST /orders` e `POST /payments/checkout/:orderId` permanecem públicos.** Não
  haverá autenticação de cliente; a proteção é rate limiting (decisão #35).
- **O evento `ORDER_PAID` fica.** A Fase 1B (WhatsApp) vai consumi-lo.

## Consequência prática

O que entrou nesta sessão — decisões #32 a #36 — foi escolhido por caber nos quatro
critérios, não por deixar o código mais bonito. As entradas do GitHub Actions (CI,
varredura de segredos e estrutura de deploy sem acionamento automático) foram
acrescentadas depois, pelo dono do projeto, ao escopo desta mesma sessão.
