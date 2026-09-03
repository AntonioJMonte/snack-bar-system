import { z } from 'zod';
import { roleSchema } from './common';
import { orderSchema } from './orders';

// ─────────── Catálogo completo (GET /menu/catalog, gerente+) ───────────
// Diferente do cardápio público: inclui itens e adicionais INATIVOS.

export const adminAddonSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  priceCents: z.number().int().min(0),
  itemId: z.uuid(),
  active: z.boolean(),
});
export type AdminAddon = z.infer<typeof adminAddonSchema>;

export const adminItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  priceCents: z.number().int().min(0),
  discountPercent: z.number().int().min(0).max(100),
  photoUrl: z.string().nullable(),
  soldOut: z.boolean(),
  active: z.boolean(),
  categoryId: z.uuid(),
  addons: z.array(adminAddonSchema),
});
export type AdminItem = z.infer<typeof adminItemSchema>;

export const adminCategorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  displayOrder: z.number().int(),
  active: z.boolean(),
  items: z.array(adminItemSchema),
});
export type AdminCategory = z.infer<typeof adminCategorySchema>;

export const adminCatalogSchema = z.array(adminCategorySchema);

// ─────────── Usuários (admin) ───────────

export const userSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: roleSchema,
  active: z.boolean(),
});
export type User = z.infer<typeof userSchema>;
export const usersSchema = z.array(userSchema);

export const createUserRequestSchema = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  password: z.string().min(8, 'mínimo de 8 caracteres'),
  role: roleSchema,
});
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

// ─────────── Auditoria (admin) ───────────

export const auditLogSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  oldValue: z.unknown().nullable(),
  newValue: z.unknown().nullable(),
  createdAt: z.string(),
  user: z.object({ name: z.string(), role: roleSchema }),
});
export type AuditLog = z.infer<typeof auditLogSchema>;
export const auditLogsSchema = z.array(auditLogSchema);

// ─────────── Histórico de pedidos (GET /orders, gerente+) ───────────

export const paymentSchema = z.object({
  id: z.uuid(),
  method: z.enum(['pix', 'credit_card', 'debit_card']),
  status: z.enum(['pending', 'paid', 'declined', 'refunded']),
  gatewayTransactionId: z.string().nullable(),
  amountCents: z.number().int(),
});
export type Payment = z.infer<typeof paymentSchema>;

// LISTA de pagamentos (decisão #32): um pedido pode ter várias transações — a
// recusada e a aprovada, ou duas aprovadas quando o cliente pagou duas vezes.
// É aqui que o segundo pagamento fica visível para quem precisa estornar.
export const orderHistoryEntrySchema = orderSchema.extend({
  payments: z.array(paymentSchema),
});
export type OrderHistoryEntry = z.infer<typeof orderHistoryEntrySchema>;
export const orderHistorySchema = z.array(orderHistoryEntrySchema);
