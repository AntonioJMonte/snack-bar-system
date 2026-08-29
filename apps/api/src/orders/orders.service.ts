import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
}
