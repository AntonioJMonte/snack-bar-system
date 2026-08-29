import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export interface AuditEntry {
  userId: string;
  action: string; // ex.: "item.price_changed", "store.manual_override"
  entity: string; // ex.: "Item", "StoreStatusOverride"
  entityId: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}

// Auditoria obrigatória (seção 5.5): quem, quando, o quê, valor anterior, valor
// novo. Grava na MESMA transação da mudança — ou muda com auditoria, ou não muda.
@Injectable()
export class AuditService {
  record(tx: Prisma.TransactionClient, entry: AuditEntry) {
    return tx.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
      },
    });
  }
}
