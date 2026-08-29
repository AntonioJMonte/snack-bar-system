import { Injectable, Logger } from '@nestjs/common';
import type { OrderStatus } from '@prisma/client';
import { DomainError } from '../common/domain-error';
import { PrismaService } from '../prisma/prisma.service';
import { canTransition } from './domain/status-flow';
import { StoreStatusService } from '../store/store-status.service';
import { buildOrder, type CatalogItem } from './domain/build-order';
import type { CreateOrderInput } from './dto/create-order.schema';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storeStatus: StoreStatusService,
  ) {}

  async create(input: CreateOrderInput) {
    const now = new Date();

    // Criação inteira dentro de UMA transação (seção 9): leitura do cardápio,
    // checagem da loja e gravação — ou tudo, ou nada.
    const order = await this.prisma.$transaction(async (tx) => {
      const store = await this.storeStatus.isOpenAt(now, tx);

      const itemIds = [...new Set(input.items.map((i) => i.itemId))];
      const items = await tx.item.findMany({
        where: { id: { in: itemIds } },
        include: { addons: true },
      });
      const catalog = new Map<string, CatalogItem>(items.map((i) => [i.id, i]));

      const region = input.regionId
        ? await tx.deliveryRegion.findUnique({ where: { id: input.regionId } })
        : null;

      const built = buildOrder(input, { catalog, region, store });

      return tx.order.create({
        data: {
          channel: built.channel,
          customerName: built.customerName,
          customerPhone: built.customerPhone,
          deliveryType: built.deliveryType,
          address: built.address,
          regionId: built.regionId,
          subtotalFullCents: built.subtotalFullCents,
          discountTotalCents: built.discountTotalCents,
          subtotalNetCents: built.subtotalNetCents,
          deliveryFeeCents: built.deliveryFeeCents,
          totalCents: built.totalCents,
          items: {
            create: built.items.map((it) => ({
              itemId: it.itemId,
              itemName: it.itemName,
              quantity: it.quantity,
              unitFullPriceCents: it.unitFullPriceCents,
              discountPercentApplied: it.discountPercentApplied,
              unitDiscountCents: it.unitDiscountCents,
              unitNetPriceCents: it.unitNetPriceCents,
              note: it.note,
              addons: { create: it.addons },
            })),
          },
        },
        include: { items: { include: { addons: true } } },
      });
    });

    // Rastreabilidade (seção 9.3): id registrado desde a criação.
    this.logger.log(
      `order.created id=${order.id} number=${order.number} channel=${order.channel} status=${order.status} total_cents=${order.totalCents}`,
    );

    return order;
  }

  // Visão do cliente para acompanhamento: status e resumo, nada operacional.
  findForTracking(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        number: true,
        status: true,
        deliveryType: true,
        createdAt: true,
        subtotalNetCents: true,
        deliveryFeeCents: true,
        totalCents: true,
        items: { select: { itemName: true, quantity: true, unitNetPriceCents: true } },
      },
    });
  }

  // Aceite explícito (seção 8.3): registra QUEM viu o pedido e QUANDO. É o que
  // encerra o alerta no painel. Só um pedido pago e ainda não aceito é aceitável.
  async acceptOrder(userId: string, orderId: string) {
    const accepted = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new DomainError('ORDER_NOT_FOUND', 'Pedido não existe.', { orderId });
      if (order.status !== 'awaiting_acceptance') {
        throw new DomainError(
          'INVALID_STATUS_TRANSITION',
          'Só pedidos aguardando aceite podem ser aceitos.',
          { orderId, from: order.status, to: 'accepted' },
        );
      }
      return tx.order.update({
        where: { id: orderId },
        data: { status: 'accepted', acceptedAt: new Date(), acceptedById: userId },
      });
    });
    this.logger.log(`order.accepted id=${accepted.id} by=${userId}`);
    return accepted;
  }

  // Avanço de produção (decisão #19): um passo por vez, validado pelo tipo de
  // entrega. Refletido no acompanhamento do cliente (seção 8.3).
  async advanceStatus(userId: string, orderId: string, to: OrderStatus) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new DomainError('ORDER_NOT_FOUND', 'Pedido não existe.', { orderId });
      if (!canTransition(order.deliveryType, order.status, to)) {
        throw new DomainError(
          'INVALID_STATUS_TRANSITION',
          `Transição ${order.status} → ${to} não é válida para ${order.deliveryType}.`,
          { orderId, from: order.status, to, deliveryType: order.deliveryType },
        );
      }
      return tx.order.update({ where: { id: orderId }, data: { status: to } });
    });
    this.logger.log(`order.status_advanced id=${orderId} to=${to} by=${userId}`);
    return updated;
  }
}
