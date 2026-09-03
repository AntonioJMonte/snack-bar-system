# DECISÃO #36 — Robustez do webhook

**Data:** 2026-09-02 (sessão 07)

Pré-aprovado no briefing da sessão 07 (Blocos A2 e E). Quatro correções no caminho que
confirma pagamento.

## `lock_timeout` passa a devolver 5xx

O controller tinha `@HttpCode(200)` e não ramificava por desfecho: um `lock_timeout`
saía como `200 {"outcome":"lock_timeout"}`. Com 200 o Mercado Pago considera a
notificação **entregue e não reenvia** — a notificação se perdia.

Registro honesto: na sessão 06 a decisão D1.3 foi justificada com "o Mercado Pago
reenvia o webhook". Isso era **falso** com resposta 200. O buraco só não era maior
porque a reconciliação existe — mas ela só enxerga pedidos com mais de 5 minutos, então
a janela real de recuperação chegava a ~6 minutos de alarme silencioso.

Agora devolve **503 `PAYMENT_LOCK_TIMEOUT`**. Verificado com uma segunda conexão
segurando `FOR UPDATE` na linha do pedido: `HTTP 503 após 3054ms`, com zero linhas
gravadas e o pedido intacto em `pending_payment`.

## Timeout de 8s nas chamadas ao gateway

O webhook consulta o Mercado Pago **dentro** da requisição. Sem timeout, uma
instabilidade lá prende conexões aqui, e várias notificações simultâneas travam a API.

`MercadoPagoConfig` passa a receber `options: { timeout: 8000 }`. O padrão do SDK é 10s;
8s deixa margem para o nosso 5xx sair antes de o MP desistir. Falha na consulta — timeout,
instabilidade, 500 do lado deles — vira **503 `GATEWAY_UNREACHABLE`** com `logger.error`,
nunca 2xx.

## Janela de frescor na assinatura

`validateMercadoPagoSignature` extraía o `ts` e nunca o verificava: uma assinatura
capturada valia **indefinidamente** e podia ser reenviada meses depois.

Janela de **5 minutos**, com tolerância de **1 minuto** para relógio dessincronizado
entre servidores. O `ts` é aceito em segundos ou milissegundos (documentação e
integrações reais divergem; abaixo de 10¹² é tratado como segundo).

Consequência nos testes: o helper de assinatura do e2e usava `ts` fixo de 2023, que
agora seria recusado — como deve ser. Passou a assinar com o instante da chamada, e o
spec unitário injeta relógio fixo via `now`, para testar a assinatura sem esbarrar na
janela.

## `mapMethod` não engole mais entrada desconhecida

O fallback silencioso para `credit_card` gravava método errado sem aviso — erro que só
aparece na conferência do extrato, meses depois. Agora `mapMethod` é método da classe e
emite `logger.warn` com `payment_method_id` e `payment_type_id` recebidos sempre que o
tipo não é `credit_card`.

## Tempo de resposta medido (E4)

30 webhooks contra o `FakeMercadoPago`, medidos de ponta a ponta pelo HTTP:

| Caso | min | p50 | máx | média |
|---|---|---|---|---|
| Confirma o pedido | 16ms | 21ms | 54ms | 23ms |
| Webhook duplicado | 10ms | 11ms | 18ms | 12ms |

Muito abaixo do teto de 5s. Ressalva importante: isto mede **o nosso código**. Contra o
Mercado Pago real soma-se a ida ao gateway, limitada pelo timeout de 8s — e é esse
número que precisa ser medido no sandbox.
