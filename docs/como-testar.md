# Como rodar e testar localmente

Portas: **API na 3001**, **site na 3000**. O `WEB_ORIGIN` da API libera o CORS para
a 3000 e monta as `back_urls` do gateway; o `NEXT_PUBLIC_API_URL` do site aponta
para a 3001.

## Preparação (uma vez)

```bash
# 1. Banco
docker compose up -d

# 2. Variáveis: copie e ajuste se precisar
cp apps/api/.env.example apps/api/.env       # já existe no repo local
cp apps/web/.env.example apps/web/.env.local

# 3. Dependências, client do Prisma e migrações
#    (rodar dentro do workspace: é lá que o Prisma acha o .env)
npm install
npm run prisma:generate -w apps/api
npm run prisma:migrate -w apps/api

# 4. Dados de exemplo: cardápio, horários e regiões
npm run seed:dev -w apps/api

# 5. Usuário para entrar no painel
npm run create:user -w apps/api -- admin@loja.local senha12345 admin "Dono da Loja"
```

> Ao recriar `node_modules`, rode `npm run prisma:generate -w apps/api` antes de
> compilar a API — sem isso o build falha com "@prisma/client has no exported member".

## Subir (dois terminais)

```bash
# Terminal 1 — API em http://localhost:3001
npm run start:dev -w apps/api

# Terminal 2 — site em http://localhost:3000
npm run dev -w apps/web
```

## Roteiro de teste

### Site do cliente — http://localhost:3000

O cardápio vem renderizado do servidor. O que conferir:

- **X-Salada** mostra R$ 26,90 riscado e o valor com desconto ao lado, com o selo
  "-15%".
- **X-Tudo** aparece marcado como **Esgotado** e não abre — não pode ir ao carrinho.
- Busca por nome e filtro por categoria funcionam.
- Clique no X-Salada: escolha o adicional "Ovo" e veja o total mudar. O adicional
  soma ao valor cheio **antes** do desconto (R$ 26,90 + R$ 3,00 = R$ 29,90; 15%
  disso é R$ 4,49; líquido R$ 25,41).
- No carrinho, tente enviar sem telefone ou com telefone inválido — o botão fica
  bloqueado, e o servidor recusaria de qualquer forma.
- Escolha "Receber em casa": endereço e região passam a ser obrigatórios, e a taxa
  entra no total **sem receber desconto**.

### Pagamento

O botão "Ir para o pagamento" cria o pedido no servidor e chama o gateway. **Sem
credenciais reais do Mercado Pago no `.env`, essa última chamada falha** — é
esperado, e é a pendência aberta nº 1 do projeto.

Para seguir testando o painel sem o gateway:

```bash
npm run simulate:payment -w apps/api
```

Isso marca o pedido pendente mais recente como pago, reproduzindo o **estado** que o
webhook deixaria. Não substitui o teste real: em produção o único caminho é o
webhook assinado.

### Painel de produção — http://localhost:3000/painel

Entre com `admin@loja.local` / `senha12345`.

- A barra do topo abre **vermelha, "Som DESLIGADO"** — é o comportamento exigido: o
  painel nunca finge estar alertando. Clique em **"Ativar som"**; ele toca uma vez
  para você confirmar com o ouvido.
- Rode `simulate:payment` de novo e espere até 6 segundos: o pedido aparece no topo
  com borda destacada e o som passa a repetir a cada 15 segundos.
- O telefone é clicável. A observação do item ("sem cebola") aparece em destaque.
- Clique em **Aceitar** — o som para na hora e o pedido muda de estado.
- Avance o status: em **retirada** o fluxo vai direto de "Pronto" para "Concluir",
  sem passar por "a caminho".
- Em "Configurações deste dispositivo" dá para mudar o nome do dispositivo e o
  intervalo do alerta (15 a 20 segundos).
- Acompanhe o pedido pelo lado do cliente em `/pedido/<id do pedido>` — o status
  avança sozinho a cada 10 segundos.

### Painel administrativo — http://localhost:3000/admin

- **Visão geral:** feche e reabra a loja e veja o mecanismo vigente mudar para
  "manual". Com o painel de produção aberto em outra aba, o dispositivo aparece em
  "Painéis ativos"; feche a aba e em ~2 minutos ele some, disparando o aviso de
  "nenhum painel ativo".
- **Cardápio:** mude um preço e volte ao site — o valor novo aparece. Abra o
  histórico de pedidos: **o pedido antigo mantém os valores originais**. É a regra do
  congelamento.
- **Auditoria** (só admin): a alteração de preço está lá, com valor anterior e novo
  em reais.
- **Usuários** (só admin): crie um atendente e entre com ele. O menu de administração
  some, e se você tentar `/admin` na barra de endereço é devolvido ao painel. Mais
  importante: a API rejeita a chamada direta com 403 — é o teste que importa
  (seção 14.2).

## O que os testes automatizados já cobrem

```bash
npm run test -w apps/api        # 70 unitários
npm run test:e2e -w apps/api    # 55 e2e (precisa do Docker de pé)
npm run test -w apps/web        # 39 unitários
```

Não há teste automatizado de interface. Alerta sonoro em cozinha barulhenta, Wake
Lock, PWA instalado e notificação em iOS dependem de verificação manual nos
aparelhos reais da loja (plano de testes 14.3).
