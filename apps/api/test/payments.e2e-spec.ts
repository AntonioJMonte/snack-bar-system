import { createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { ORDER_EXPIRY_MINUTES } from '../src/common/order-expiry';
import { OrdersService } from '../src/orders/orders.service';
import { PaymentsService as PaymentsServiceClass } from '../src/payments/payments.service';
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
  // Timestamp do MOMENTO: a assinatura tem janela de 5 min (decisão #36), então
  // um ts fixo de 2023 seria recusado — como deve ser.
  const ts = String(Math.floor(Date.now() / 1000));
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
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });
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
    const declined = await prisma.payment.findUniqueOrThrow({
      where: { gatewayTransactionId: 'tx-4a' },
    });
    expect(declined.status).toBe('declined');
    expect(paidEvents).toHaveLength(0); // recusa não dispara alerta (6.3)

    await webhook('tx-4b');
    const approved = await prisma.payment.findUniqueOrThrow({
      where: { gatewayTransactionId: 'tx-4b' },
    });
    expect(approved.status).toBe('paid');
    // A tentativa recusada CONTINUA no banco (decisão #32): antes o upsert a
    // sobrescrevia e o id do cartão recusado sumia do registro.
    expect(await prisma.payment.count({ where: { orderId } })).toBe(2);
    expect(
      await prisma.payment.count({ where: { orderId, gatewayTransactionId: 'tx-4a' } }),
    ).toBe(1);
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

describe('concorrência entre webhook e reconciliação (e2e)', () => {
  it('webhook e reconciliação simultâneos sobre o mesmo pedido publicam order.paid UMA vez', async () => {
    const { orderId, totalCents } = await createPendingOrder();
    // Antigo o bastante para a reconciliação enxergar o pedido.
    await prisma.order.update({
      where: { id: orderId },
      data: { createdAt: new Date(Date.now() - 10 * 60 * 1000) },
    });
    fakeGateway.payments.set('tx-race', {
      id: 'tx-race',
      status: 'approved',
      externalReference: orderId,
      transactionAmount: totalCents / 100,
      paymentMethodId: 'pix',
      paymentTypeId: 'bank_transfer',
    });

    const { PaymentsService } = await import('../src/payments/payments.service');
    const service = app.get(PaymentsService);

    // Dez chamadas concorrentes sobre o MESMO pedido: cinco pelo webhook, cinco
    // pela reconciliação. Sem serialização no banco, duas delas conseguem ler
    // `pending_payment` antes de qualquer commit e ambas publicam o evento.
    await Promise.all([
      webhook('tx-race'),
      service.reconcilePendingOrders(5),
      webhook('tx-race'),
      service.reconcilePendingOrders(5),
      webhook('tx-race'),
      service.reconcilePendingOrders(5),
      webhook('tx-race'),
      service.reconcilePendingOrders(5),
      webhook('tx-race'),
      service.reconcilePendingOrders(5),
    ]);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('awaiting_acceptance');
    expect(await prisma.payment.count()).toBe(1);

    // A asserção que importa (seção 9.1): um pedido pago, um alerta.
    expect(
      paidEvents.length,
      `order.paid foi publicado ${paidEvents.length}x — esperado exatamente 1`,
    ).toBe(1);
  });
});

// ─────────── Pagamento duplicado no mesmo pedido (decisão #32) ───────────

describe('duas transações no mesmo pedido (e2e)', () => {
  it('cartão recusado, Pix aprovado e cartão aprovado com atraso: TODAS ficam no banco', async () => {
    const { orderId, totalCents } = await createPendingOrder();
    const reais = totalCents / 100;
    const base = { externalReference: orderId, transactionAmount: reais };
    fakeGateway.payments.set('tx-card-1', {
      ...base,
      id: 'tx-card-1',
      status: 'rejected',
      paymentMethodId: 'master',
      paymentTypeId: 'credit_card',
    });
    fakeGateway.payments.set('tx-pix-2', {
      ...base,
      id: 'tx-pix-2',
      status: 'approved',
      paymentMethodId: 'pix',
      paymentTypeId: 'bank_transfer',
    });
    fakeGateway.payments.set('tx-card-3', {
      ...base,
      id: 'tx-card-3',
      status: 'approved',
      paymentMethodId: 'master',
      paymentTypeId: 'credit_card',
    });

    await webhook('tx-card-1');
    await webhook('tx-pix-2');
    const late = await webhook('tx-card-3');

    // O segundo APROVADO é registrado, não descartado: entrou dinheiro duas
    // vezes e alguém precisa estornar. Antes isto sumia sem deixar rastro.
    expect(((await late.json()) as { outcome: string }).outcome).toBe('duplicate_payment');

    const payments = await prisma.payment.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
    expect(payments.map((p) => p.gatewayTransactionId)).toEqual([
      'tx-card-1',
      'tx-pix-2',
      'tx-card-3',
    ]);
    expect(payments.filter((p) => p.status === 'paid')).toHaveLength(2);

    // Um pedido, um alerta — mesmo com dois pagamentos aprovados (seção 9.1).
    expect(paidEvents).toHaveLength(1);
  });

  it('estorno chega no MESMO id do pagamento e é registrado', async () => {
    const { orderId, totalCents } = await createPendingOrder();
    const payment = {
      id: 'tx-estorno',
      externalReference: orderId,
      transactionAmount: totalCents / 100,
      paymentMethodId: 'pix',
      paymentTypeId: 'bank_transfer',
    };
    fakeGateway.payments.set('tx-estorno', { ...payment, status: 'approved' });
    await webhook('tx-estorno');

    // O gateway devolve o MESMO id com status novo. O curto-circuito de
    // idempotência engolia este caso e o estorno nunca era gravado.
    fakeGateway.payments.set('tx-estorno', { ...payment, status: 'refunded' });
    await webhook('tx-estorno');

    const stored = await prisma.payment.findUniqueOrThrow({
      where: { gatewayTransactionId: 'tx-estorno' },
    });
    expect(stored.status).toBe('refunded');
    expect(await prisma.payment.count({ where: { orderId } })).toBe(1);
  });
});

// ─────────── Expiração e pagamento tardio (decisão #34) ───────────

describe('expiração do pedido não pago (e2e)', () => {
  async function backdate(orderId: string, minutes: number) {
    await prisma.order.update({
      where: { id: orderId },
      data: { createdAt: new Date(Date.now() - minutes * 60 * 1000) },
    });
  }

  it('pedido abandonado além da janela vira expired e SAI da reconciliação', async () => {
    const { orderId, totalCents } = await createPendingOrder();
    await backdate(orderId, ORDER_EXPIRY_MINUTES + 5);
    // O gateway TEM um pagamento aprovado para este pedido: se a reconciliação
    // ainda o enxergasse, ele seria regularizado e o teste falharia.
    fakeGateway.payments.set('tx-zumbi', {
      id: 'tx-zumbi',
      status: 'approved',
      externalReference: orderId,
      transactionAmount: totalCents / 100,
      paymentMethodId: 'pix',
      paymentTypeId: 'bank_transfer',
    });

    const ordersService = app.get(OrdersService);
    expect(await ordersService.expireAbandonedOrders()).toEqual({ expired: 1 });

    const expired = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(expired.status).toBe('expired');
    expect(expired.expiredAt).not.toBeNull();

    const service = app.get(PaymentsServiceClass);
    expect(await service.reconcilePendingOrders(5)).toEqual({ checked: 0, regularized: 0 });
    expect(paidEvents).toHaveLength(0);
  });

  it('pedido dentro da janela NÃO expira', async () => {
    const { orderId } = await createPendingOrder();
    await backdate(orderId, ORDER_EXPIRY_MINUTES - 5);
    const ordersService = app.get(OrdersService);
    expect(await ordersService.expireAbandonedOrders()).toEqual({ expired: 0 });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('pending_payment');
  });

  it('pagamento que chega DEPOIS da expiração volta para aceite, marcado', async () => {
    const { orderId, totalCents } = await createPendingOrder();
    await backdate(orderId, ORDER_EXPIRY_MINUTES + 5);
    await app.get(OrdersService).expireAbandonedOrders();

    fakeGateway.payments.set('tx-tardio', {
      id: 'tx-tardio',
      status: 'approved',
      externalReference: orderId,
      transactionAmount: totalCents / 100,
      paymentMethodId: 'pix',
      paymentTypeId: 'bank_transfer',
    });
    const response = await webhook('tx-tardio');
    expect(((await response.json()) as { outcome: string }).outcome).toBe('became_paid');

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    // Volta para aceite porque quem pagou está esperando o lanche — mas o aceite
    // é humano e a marca diz à pessoa que este pedido não é novo (decisão #34).
    expect(order.status).toBe('awaiting_acceptance');
    expect(order.paidAfterExpiryAt).not.toBeNull();
    expect(paidEvents).toHaveLength(1);
  });

  it('pedido expirado não aceita novo checkout — precisa de pedido novo', async () => {
    const { orderId } = await createPendingOrder();
    await backdate(orderId, ORDER_EXPIRY_MINUTES + 5);
    await app.get(OrdersService).expireAbandonedOrders();

    const response = await fetch(`${baseUrl}/payments/checkout/${orderId}`, { method: 'POST' });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { code: string }).code).toBe('ORDER_NOT_PAYABLE');
  });
});
