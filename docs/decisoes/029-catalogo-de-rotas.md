# DECISÃO #29 — O que cada arquivo de rota contém

**Data:** 2026-09-01 (sessão 05)

**Contexto:** no site, as URLs viviam como literais dentro do corpo das funções, em
três arquivos organizados por TELA (`endpoints.ts`, `panel-endpoints.ts`,
`admin-endpoints.ts`) e não por caso de uso. Não havia lugar onde se visse "todas as
rotas de cardápio" com seus métodos. Pior: o método HTTP era explícito em algumas
chamadas (`method: 'PATCH'`) e implícito em outras (GET, por ser o padrão do fetch).

## Opção A — Catálogo apenas
Cada `xRoute.ts` declara só método, URL e perfil exigido. As funções de chamada
continuam nos arquivos de endpoints, importando dali.
- Prós: um lugar único para achar toda rota possível; a mudança é aditiva e os
  arquivos de endpoints seguem reconhecíveis.
- Contras: ler uma chamada inteira exige abrir dois arquivos.

## Opção B — Caso de uso completo
Cada `xRoute.ts` contém método, URL, chamada e validação; os três arquivos de
endpoints deixariam de existir.
- Prós: separação por caso de uso de ponta a ponta.
- Contras: refatoração maior; mistura declaração de rota com política de cache e
  validação de resposta.

**Recomendação apresentada:** B.
**Custo de reverter:** baixo em ambas.

## Resposta do usuário
> "Quero que o arquivo contenha apenas catálogo de rotas, isso facilita achar todas
> as rotas possíveis do código"

**Resultado:** opção A. Criado `apps/web/src/routes/` com um arquivo por caso de uso
(`authRoute`, `menuRoute`, `storeRoute`, `orderRoute`, `paymentRoute`, `panelRoute`,
`userRoute`, `auditRoute`), mais `types.ts` com o tipo `Route` e o helper `route()`,
e um `index.ts` que reexporta tudo.

Cada entrada declara três coisas: `method`, `url` (sempre uma função, mesmo quando
não tem parâmetro, para o consumo ser uniforme) e `minRole`. O `minRole` é
**documentação do que o servidor exige** — quem decide acesso continua sendo o guard
da API em toda requisição (seção 12.2); o front jamais usa esse campo para liberar
ou bloquear ação.

Aproveitou-se para tornar o método HTTP **sempre explícito** nas chamadas, vindo do
catálogo, eliminando a inconsistência entre GET implícito e PATCH explícito.

O webhook `POST /payments/webhook/mercadopago` NÃO entrou no catálogo, de propósito:
é chamado pelo gateway servidor a servidor e o navegador nunca deve chamá-lo. Sua
existência está registrada em comentário no `paymentRoute.ts`.
