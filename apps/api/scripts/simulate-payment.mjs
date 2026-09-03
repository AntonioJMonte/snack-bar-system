// FERRAMENTA DE DESENVOLVIMENTO. Marca um pedido como pago para exercitar o
// painel sem credenciais do gateway.
//
// Isto NÃO substitui o teste real: o caminho de produção é sempre o webhook
// assinado (seção 5.3), e a validação da assinatura contra o sandbox do Mercado
// Pago continua sendo pendência aberta. O que este script reproduz é apenas o
// ESTADO final que o webhook deixaria no banco.
//
// Uso: node scripts/simulate-payment.mjs [numero-do-pedido]
//      sem argumento, paga o pedido pendente mais recente.
import { PrismaClient } from '@prisma/client';
import process from 'node:process';

const prisma = new PrismaClient();

const url = process.env.DATABASE_URL ?? '';
if (!url.includes('lanchonete_dev')) {
  console.error('Recusa de segurança: este script só roda contra lanchonete_dev.');
  process.exit(1);
}

const argument = process.argv[2];
const order = argument
  ? await prisma.order.findUnique({ where: { number: Number(argument) } })
  : await prisma.order.findFirst({
      where: { status: 'pending_payment' },
      orderBy: { createdAt: 'desc' },
    });

if (!order) {
  console.error(
    argument
      ? `Pedido #${argument} não encontrado.`
      : 'Nenhum pedido aguardando pagamento. Faça um pedido pelo site primeiro.',
  );
  process.exit(1);
}

if (order.status !== 'pending_payment') {
  console.error(`Pedido #${order.number} não está aguardando pagamento (está em ${order.status}).`);
  process.exit(1);
}

// Espelha o que o webhook faz: grava o pagamento com um id de transação único e
// leva o pedido para "aguardando aceite", que é o estado que dispara o alerta.
await prisma.$transaction(async (tx) => {
  // Uma linha por transação (decisão #32): o id simulado é único por pedido, e
  // rodar o script duas vezes falha no UNIQUE em vez de sobrescrever silenciosamente.
  await tx.payment.create({
    data: {
      orderId: order.id,
      method: 'pix',
      status: 'paid',
      gatewayTransactionId: `SIMULADO-${order.id}`,
      amountCents: order.totalCents,
    },
  });
  await tx.order.update({
    where: { id: order.id },
    data: { status: 'awaiting_acceptance' },
  });
});

console.log(
  `Pedido #${order.number} marcado como PAGO (${(order.totalCents / 100).toFixed(2)}).\n` +
    'Abra o painel em http://localhost:3000/painel — o alerta deve disparar.',
);
await prisma.$disconnect();
