# DECISÃO #13 — Fuso horário e formato de data/hora persistidos

**Data:** 2026-08-29 (sessão 01)
Corresponde ao item 12 da lista da Etapa 2 do prompt.

**Contexto:** afeta horário de funcionamento por dia da semana e a expiração da
sobreposição manual "ao final do dia" (seção 5.5) — conceito do fuso da loja, não de UTC.

## Opção A — UTC no dado (`timestamptz`) + fuso da loja como configuração
Fuso IANA (`America/Sao_Paulo`) aplicado na lógica de domínio ao calcular "hoje",
horário de funcionamento e expiração diária.
- Prós: dado sem ambiguidade; comparações exatas; mudanças de fuso/horário de verão
  viram problema da biblioteca, não do dado.
- Contras: todo cálculo de "dia da loja" passa pela conversão — concentrar num serviço
  único de relógio/calendário testável.

## Opção B — Horário local da loja (`timestamp` sem fuso)
- Prós: leitura direta.
- Contras: dado ambíguo; integrações externas (gateway em UTC) exigem conversão inversa
  espalhada.

**Recomendação:** A. Horários de funcionamento são gravados como hora local + dia da
semana (regras recorrentes, não instantes).
**Custo de reverter:** alto — reinterpretar timestamps gravados é migração ambígua.

## Resposta do usuário
> "Opção A para todas as decisões"

**Resultado:** `timestamptz` (UTC) em todos os instantes; `STORE_TIMEZONE=America/Sao_Paulo`
como configuração; serviço único responsável por "que dia é hoje para a loja".
