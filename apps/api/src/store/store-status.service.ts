import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ENV, type Env } from '../config/env';
import type { StoreOpenStatus } from '../orders/domain/build-order';
import { storeLocalParts } from './store-clock';
import { resolveStoreStatus } from './store-status';

@Injectable()
export class StoreStatusService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  // Recebe o cliente transacional para que a checagem participe da MESMA
  // transação da criação do pedido.
  async isOpenAt(now: Date, tx: Prisma.TransactionClient): Promise<StoreOpenStatus> {
    const override = await tx.storeStatusOverride.findFirst({
      where: { expiresAt: { gt: now } },
      orderBy: { setAt: 'desc' },
    });
    const schedules = await tx.storeSchedule.findMany();
    return resolveStoreStatus(override, schedules, storeLocalParts(now, this.env.STORE_TIMEZONE));
  }
}
