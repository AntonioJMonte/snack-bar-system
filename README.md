# Sistema de Pedidos para Lanchonete

[![CI](https://github.com/AntonioJMonte/snack-bar-system/actions/workflows/ci.yml/badge.svg)](https://github.com/AntonioJMonte/snack-bar-system/actions/workflows/ci.yml)

O cliente abre o site no celular, monta o pedido, informa o telefone, paga por Pix
e a loja é alertada, vê o pedido na tela e o aceita.

**O sistema não depende de impressora.** Um pedido é válido, confirmado e produzível
assim que o pagamento é validado e persistido.

## Onde ler

| Assunto | Arquivo |
|---|---|
| Estado real do projeto e próximo passo | [ESTADO.md](ESTADO.md) |
| Como rodar tudo localmente, passo a passo | [docs/como-testar.md](docs/como-testar.md) |
| Toda decisão tomada, uma por arquivo | [docs/decisoes/](docs/decisoes/) |
| Relatório de cada sessão de trabalho | [docs/relatorios/](docs/relatorios/) |

## Estrutura

- `apps/api` — NestJS 11, Prisma 6, PostgreSQL 17. Cálculo de preço, pedido,
  pagamento e painel. **Todo total sai daqui**: preço vindo do cliente é ignorado.
- `apps/web` — Next.js 16. Site do cliente, painel de produção e painel administrativo.
- `packages/contracts` — schemas Zod e as funções puras que valem para os dois lados
  (preço, telefone, transições de status).

## Rodando

```bash
docker compose up -d          # PostgreSQL 17
npm ci
npm run build -w packages/contracts
npm run prisma:generate -w apps/api
npm run prisma:migrate -w apps/api
npm run seed:dev -w apps/api  # cardápio e horários de exemplo
npm run start:dev -w apps/api # API na 3001
npm run dev -w apps/web       # site na 3000
```

Dinheiro é **sempre centavo inteiro**. Ponto flutuante para valor monetário é
proibido em qualquer circunstância.
