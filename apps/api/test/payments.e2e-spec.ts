import { createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { ORDER_PAID, type OrderPaidEvent } from '../src/common/events';
import { MercadoPagoClient, type GatewayPayment } from '../src/payments/gateway';
import { PrismaService } from '../src/prisma/prisma.service';
import { postOrder, seedCatalog, seedOpenAllDay, truncateAll } from './seed';
import { TEST_ENV } from './test-env';

// Fluxo do webhook validado de ponta a ponta SEM credenciais reais: o client do
// gateway é substituído por um fake; assinatura, idempotência, conferência de
// valor e publicação única do evento são todos código NOSSO, exercitado de verdade.

class FakeMercadoPago {
  payments = new Map<string, GatewayPayment>();

  async getPayment(id: string): Promise<GatewayPayment> {
    const payment = this.payments.get(id);
    if (!payment) throw new Error(`fake: pagamento ${id} não cadastrado`);
    return payment;
  }

  async searchPaymentsByReference(orderId: string): Promise<GatewayPayment[]> {
    return [...this.payments.values()].filter((p) => p.externalReference === orderId);
  }

  async createCheckout(): Promise<{ initPoint: string }> {
    return { initPoint: 'https://fake.mercadopago/checkout' };
  }
}

let app: INestApplication;
let prisma: PrismaService;
let baseUrl: string;
let fakeGateway: FakeMercadoPago;
let paidEvents: OrderPaidEvent[];

function signedHeaders(dataId: string, secret: string = TEST_ENV.MP_WEBHOOK_SECRET) {
  const ts = '1700000000';
  const requestId = 'req-e2e';
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex');
  return {
    'content-type': 'application/json',
    'x-signature': `ts=${ts},v1=${v1}`,
    'x-request-id': requestId,
  };
}

function webhook(dataId: string, headers = signedHeaders(dataId)) {
  return fetch(`${baseUrl}/payments/webhook/mercadopago?type=payment&data.id=${dataId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'payment', data: { id: dataId } }),
  });
}

async function createPendingOrder(): Promise<{ orderId: string; totalCents: number }> {
  const { item } = await seedCatalog(prisma);
  await seedOpenAllDay(prisma);
  const response = await postOrder(baseUrl, {
    customerName: 'Maria',
    customerPhone: '11987654321',
    deliveryType: 'pickup',
    items: [{ itemId: item.id, quantity: 2 }],
  });
  expect(response.status).toBe(201);
  const body = (await response.json()) as { id: string; totalCents: number };
  return { orderId: body.id, totalCents: body.totalCents };
}

beforeAll(async () => {
  fakeGateway = new FakeMercadoPago();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MercadoPagoClient)
    .useValue(fakeGateway)
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  await app.listen(0);
  const address = app.getHttpServer().address() as { port: number };
  baseUrl = `http://127.0.0.1:${address.port}`;
  prisma = app.get(PrismaService);

  paidEvents = [];
  app.get(EventEmitter2).on(ORDER_PAID, (event: OrderPaidEvent) => paidEvents.push(event));
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await truncateAll(prisma);
  fakeGateway.payments.clear();
  paidEvents.length = 0;
});

describe('webhook do Mercado Pago (e2e)', () => {
  it('pagamento aprovado confirma o pedido e publica order.paid UMA vez, mesmo com webhook duplicado', async () => {
    const { orderId, totalCents } = await createPendingOrder();
    fakeGateway.payments.set('tx-1', {
      id: 'tx-1',
      status: 'approved',
      externalReference: orderId,
      transactionAmount: totalCents / 100,
      paymentMethodId: 'pix',
      paymentTypeId: 'bank_transfer',
    });

    const first = await webhook('tx-1');
    expect(first.status).toBe(200);
    expect(((await first.json()) as { outcome: string }).outcome).toBe('became_paid');

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('awaiting_acceptance');
    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId } });
    expect(payment).toMatchObject({
      status: 'paid',
      method: 'pix',
      gatewayTransactionId: 'tx-1',
      amountCents: totalCents,
    });

    // Webhook duplicado: um pedido, um alerta (seção 9.1).
    const second = await webhook('tx-1');
    expect(((await second.json()) as { outcome: string }).outcome).toBe('already_processed');
    expect(await prisma.payment.count()).toBe(1);
    expect(paidEvents).toHaveLength(1);
    expect(paidEvents[0].orderId).toBe(orderId);
  });

  it('assinatura inválida: 401, nada confirmado', async () => {
    const { orderId, totalCents } = await createPendingOrder();
    fakeGateway.payments.set('tx-2', {
      id: 'tx-2',
      status: 'approved',
      externalReference: orderId,
      transactionAmount: totalCents / 100,
      paymentMethodId: 'pix',
      paymentTypeId: 'bank_transfer',
    });

    const response = await webhook('tx-2', signedHeaders('tx-2', 'segredo-errado'));
    expect(response.status).toBe(401);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('pending_payment');
    expect(await prisma.payment.count()).toBe(0);
    expect(paidEvents).toHaveLength(0);
  });

  it('valor divergente do total: pedido NÃO confirmado', async () => {
    const { orderId, totalCents } = await createPendingOrder();
    fakeGateway.payments.set('tx-3', {
      id: 'tx-3',
      status: 'approved',
      externalReference: orderId,
      transactionAmount: (totalCents - 100) / 100, // pagou 1 real a menos
      paymentMethodId: 'pix',
      paymentTypeId: 'bank_transfer',
    });

    const response = await webhook('tx-3');
    expect(response.status).toBe(200);
    expect(((await response.json()) as { outcome: string }).outcome).toBe('amount_mismatch');

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('pending_payment');
    expect(await prisma.payment.count()).toBe(0);
    expect(paidEvents).toHaveLength(0);
  });

  it('recusado e depois aprovado: cliente tenta de novo, um pagamento por pedido', async () => {
    const { orderId, totalCents } = await createPendingOrder();
    fakeGateway.payments.set('tx-4a', {
      id: 'tx-4a',
      status: 'rejected',
      externalReference: orderId,
      transactionAmount: totalCents / 100,
      paymentMethodId: 'master',
      paymentTypeId: 'credit_card',
    });
    fakeGateway.payments.set('tx-4b', {
      id: 'tx-4b',
      status: 'approved',
      externalReference: orderId,
      transactionAmount: totalCents / 100,
      paymentMethodId: 'pix',
      paymentTypeId: 'bank_transfer',
    });

    await webhook('tx-4a');
    let payment = await prisma.payment.findUniqueOrThrow({ where: { orderId } });
    expect(payment.status).toBe('declined');
    expect(paidEvents).toHaveLength(0); // recusa não dispara alerta (6.3)

    await webhook('tx-4b');
    payment = await prisma.payment.findUniqueOrThrow({ where: { orderId } });
    expect(payment).toMatchObject({ status: 'paid', gatewayTransactionId: 'tx-4b' });
    expect(await prisma.payment.count()).toBe(1);
    expect(paidEvents).toHaveLength(1);
  });

  it('evento de outro tipo é reconhecido e ignorado', async () => {
    const response = await fetch(`${baseUrl}/payments/webhook/mercadopago?type=test`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'test' }),
    });
    expect(response.status).toBe(200);
  });
});

describe('reconciliação (e2e)', () => {
  it('webhook nunca recebido: reconciliação regulariza o pedido e publica order.paid uma vez', async () => {
    const { orderId, totalCents } = await createPendingOrder();
    // Pedido "antigo" o bastante para entrar na janela de reconciliação:
    await prisma.order.update({
      where: { id: orderId },
      data: { createdAt: new Date(Date.now() - 10 * 60 * 1000) },
    });
    // O gateway tem o pagamento aprovado, mas o webhook nunca chegou:
    fakeGateway.payments.set('tx-rec', {
      id: 'tx-rec',
      status: 'approved',
      externalReference: orderId,
      transactionAmount: totalCents / 100,
      paymentMethodId: 'pix',
      paymentTypeId: 'bank_transfer',
    });

    const { PaymentsService } = await import('../src/payments/payments.service');
    const service = app.get(PaymentsService);
    const result = await service.reconcilePendingOrders(5);
    expect(result).toEqual({ checked: 1, regularized: 1 });

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('awaiting_acceptance');
    expect(paidEvents).toHaveLength(1);

    // Rodar de novo: nada pendente, nada duplicado (idempotência reaproveitada).
    const again = await service.reconcilePendingOrders(5);
    expect(again).toEqual({ checked: 0, regularized: 0 });
    expect(paidEvents).toHaveLength(1);
    expect(await prisma.payment.count()).toBe(1);
  });

  it('pedido recente demais fica fora da janela (dá tempo do webhook chegar)', async () => {
    const { orderId, totalCents } = await createPendingOrder();
    fakeGateway.payments.set('tx-rec2', {
      id: 'tx-rec2',
      status: 'approved',
      externalReference: orderId,
      transactionAmount: totalCents / 100,
      paymentMethodId: 'pix',
      paymentTypeId: 'bank_transfer',
    });
    const { PaymentsService } = await import('../src/payments/payments.service');
    const result = await app.get(PaymentsService).reconcilePendingOrders(5);
    expect(result).toEqual({ checked: 0, regularized: 0 });
  });
});

describe('checkout (e2e)', () => {
  it('gera link de pagamento para pedido pendente; recusa pedido já pago', async () => {
    const { orderId, totalCents } = await createPendingOrder();

    const checkout = await fetch(`${baseUrl}/payments/checkout/${orderId}`, { method: 'POST' });
    expect(checkout.status).toBe(201);
    expect(((await checkout.json()) as { initPoint: string }).initPoint).toContain('fake.mercadopago');

    fakeGateway.payments.set('tx-5', {
      id: 'tx-5',
      status: 'approved',
      externalReference: orderId,
      transactionAmount: totalCents / 100,
      paymentMethodId: 'pix',
      paymentTypeId: 'bank_transfer',
    });
    await webhook('tx-5');

    const again = await fetch(`${baseUrl}/payments/checkout/${orderId}`, { method: 'POST' });
    expect(again.status).toBe(422);
    expect(JSON.stringify(await again.json())).toContain('ORDER_NOT_PAYABLE');
  });

  it('pedido inexistente: 404', async () => {
    const response = await fetch(
      `${baseUrl}/payments/checkout/01890a5d-ac96-774b-bcce-b30209999999`,
      { method: 'POST' },
    );
    expect(response.status).toBe(404);
  });
});
