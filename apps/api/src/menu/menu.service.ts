import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

// Mudanças do cardápio afetam apenas pedidos FUTUROS: os valores dos pedidos
// existentes estão congelados no item do pedido (seção 5.4).
@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async updateItemAudited(
    userId: string,
    itemId: string,
    action: string,
    data: { priceCents?: number; discountPercent?: number; soldOut?: boolean },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: itemId } });
      if (!item) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', itemId });

      const updated = await tx.item.update({ where: { id: itemId }, data });
      const fields = Object.keys(data) as (keyof typeof data)[];
      await this.audit.record(tx, {
        userId,
        action,
        entity: 'Item',
        entityId: itemId,
        oldValue: Object.fromEntries(fields.map((f) => [f, item[f]])),
        newValue: Object.fromEntries(fields.map((f) => [f, updated[f]])),
      });
      return updated;
    });
  }

  // ——— Cadastro (auditado: cadastrar/editar afeta preço e disponibilidade) ———

  createCategory(userId: string, data: { name: string; displayOrder: number }) {
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.create({ data });
      await this.audit.record(tx, {
        userId,
        action: 'category.created',
        entity: 'Category',
        entityId: category.id,
        newValue: data,
      });
      return category;
    });
  }

  updateCategory(
    userId: string,
    categoryId: string,
    data: { name?: string; displayOrder?: number; active?: boolean },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({ where: { id: categoryId } });
      if (!category) throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', categoryId });
      const updated = await tx.category.update({ where: { id: categoryId }, data });
      const fields = Object.keys(data) as (keyof typeof data)[];
      await this.audit.record(tx, {
        userId,
        action: 'category.updated',
        entity: 'Category',
        entityId: categoryId,
        oldValue: Object.fromEntries(fields.map((f) => [f, category[f]])),
        newValue: Object.fromEntries(fields.map((f) => [f, updated[f]])),
      });
      return updated;
    });
  }

  createItem(
    userId: string,
    data: {
      name: string;
      description?: string;
      priceCents: number;
      discountPercent: number;
      photoUrl?: string;
      categoryId: string;
      addons: { name: string; priceCents: number }[];
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({ where: { id: data.categoryId } });
      if (!category) {
        throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', categoryId: data.categoryId });
      }
      const { addons, ...itemData } = data;
      const item = await tx.item.create({
        data: { ...itemData, addons: { create: addons } },
        include: { addons: true },
      });
      await this.audit.record(tx, {
        userId,
        action: 'item.created',
        entity: 'Item',
        entityId: item.id,
        newValue: { name: data.name, priceCents: data.priceCents, discountPercent: data.discountPercent },
      });
      return item;
    });
  }

  updateItem(
    userId: string,
    itemId: string,
    data: {
      name?: string;
      description?: string | null;
      photoUrl?: string | null;
      active?: boolean;
      categoryId?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: itemId } });
      if (!item) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', itemId });
      if (data.categoryId) {
        const category = await tx.category.findUnique({ where: { id: data.categoryId } });
        if (!category) {
          throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', categoryId: data.categoryId });
        }
      }
      const updated = await tx.item.update({ where: { id: itemId }, data });
      const fields = Object.keys(data) as (keyof typeof data)[];
      await this.audit.record(tx, {
        userId,
        action: 'item.updated',
        entity: 'Item',
        entityId: itemId,
        oldValue: Object.fromEntries(fields.map((f) => [f, item[f]])),
        newValue: Object.fromEntries(fields.map((f) => [f, updated[f]])),
      });
      return updated;
    });
  }

  createAddon(userId: string, itemId: string, data: { name: string; priceCents: number }) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: itemId } });
      if (!item) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', itemId });
      const addon = await tx.addon.create({ data: { ...data, itemId } });
      await this.audit.record(tx, {
        userId,
        action: 'addon.created',
        entity: 'Addon',
        entityId: addon.id,
        newValue: { itemId, ...data },
      });
      return addon;
    });
  }

  updateAddon(
    userId: string,
    addonId: string,
    data: { name?: string; priceCents?: number; active?: boolean },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const addon = await tx.addon.findUnique({ where: { id: addonId } });
      if (!addon) throw new NotFoundException({ code: 'ADDON_NOT_FOUND', addonId });
      const updated = await tx.addon.update({ where: { id: addonId }, data });
      const fields = Object.keys(data) as (keyof typeof data)[];
      await this.audit.record(tx, {
        userId,
        action: 'addon.updated',
        entity: 'Addon',
        entityId: addonId,
        oldValue: Object.fromEntries(fields.map((f) => [f, addon[f]])),
        newValue: Object.fromEntries(fields.map((f) => [f, updated[f]])),
      });
      return updated;
    });
  }

  // ——— Operações pontuais ———

  updatePrice(userId: string, itemId: string, priceCents: number) {
    return this.updateItemAudited(userId, itemId, 'item.price_changed', { priceCents });
  }

  updateDiscount(userId: string, itemId: string, discountPercent: number) {
    return this.updateItemAudited(userId, itemId, 'item.discount_changed', { discountPercent });
  }

  setSoldOut(userId: string, itemId: string, soldOut: boolean) {
    return this.updateItemAudited(userId, itemId, 'item.sold_out_changed', { soldOut });
  }
}
