import { z } from 'zod';
import { channelSchema, deliveryTypeSchema, orderStatusSchema } from './common';
import { normalizeBrazilianPhone } from './phone';

// ───────────── Request: POST /orders ─────────────
// Campos desconhecidos (preço, desconto, total…) são REMOVIDOS pelo Zod (modo strip):
// valores vindos do cliente são ignorados, não lidos — exigência da seção 5.4.

const orderItemInputSchema = z.object({
  itemId: z.uuid(),
  quantity: z.number().int().positive(),
  note: z.string().trim().max(500).optional(),
  addonIds: z.array(z.uuid()).default([]),
});
export type OrderItemInput = z.input<typeof orderItemInputSchema>;

export const createOrderSchema = z
  .object({
    channel: z.enum(['web', 'whatsapp']).default('web'),
    customerName: z.string().trim().min(1),
    customerPhone: z.string().transform((value, ctx) => {
      const normalized = normalizeBrazilianPhone(value);
      if (!normalized) {
        ctx.addIssue({
          code: 'custom',
          message: 'telefone brasileiro inválido — DDD obrigatório',
        });
        return z.NEVER;
      }
      return normalized;
    }),
    deliveryType: z.enum(['pickup', 'delivery']),
    address: z.string().trim().min(1).optional(),
    regionId: z.uuid().optional(),
    items: z.array(orderItemInputSchema).min(1),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryType === 'delivery') {
      if (!data.address) {
        ctx.addIssue({ code: 'custom', path: ['address'], message: 'endereço obrigatório na entrega' });
      }
      if (!data.regionId) {
        ctx.addIssue({ code: 'custom', path: ['regionId'], message: 'região obrigatória na entrega' });
      }
    }
  })
  .transform((data) =>
    // Retirada com endereço: aceito e ignorado (plano de testes 14.1).
    data.deliveryType === 'pickup' ? { ...data, address: undefined, regionId: undefined } : data,
  );

export type CreateOrderInput = z.output<typeof createOrderSchema>;
export type CreateOrderRequest = z.input<typeof createOrderSchema>;

// ───────────── Responses ─────────────
// Datas viajam como ISO string no JSON.

export const orderItemAddonSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  priceCents: z.number().int(),
});

export const orderItemSchema = z.object({
  id: z.uuid(),
  itemId: z.uuid(),
  itemName: z.string(),
  quantity: z.number().int().positive(),
  unitFullPriceCents: z.number().int(),
  discountPercentApplied: z.number().int(),
  unitDiscountCents: z.number().int(),
  unitNetPriceCents: z.number().int(),
  note: z.string().nullable(),
  addons: z.array(orderItemAddonSchema),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

// Pedido completo: retorno de POST /orders e itens da lista do painel.
export const orderSchema = z.object({
  id: z.uuid(),
  number: z.number().int(),
  channel: channelSchema,
  status: orderStatusSchema,
  customerName: z.string(),
  customerPhone: z.string(),
  deliveryType: deliveryTypeSchema,
  address: z.string().nullable(),
  regionId: z.string().nullable(),
  subtotalFullCents: z.number().int(),
  discountTotalCents: z.number().int(),
  subtotalNetCents: z.number().int(),
  deliveryFeeCents: z.number().int(),
  totalCents: z.number().int(),
  createdAt: z.string(),
  // Marca permanente do pagamento recebido apos a expiracao (decisao #34): o
  // painel destaca o pedido para que ninguem o confunda com um pedido novo.
  paidAfterExpiryAt: z.string().nullable().optional(),
  acceptedAt: z.string().nullable(),
  acceptedById: z.string().nullable(),
  items: z.array(orderItemSchema),
});
export type Order = z.infer<typeof orderSchema>;

// GET /orders/:id/tracking — visão do cliente, nada operacional.
export const orderTrackingSchema = z.object({
  id: z.uuid(),
  number: z.number().int(),
  status: orderStatusSchema,
  deliveryType: deliveryTypeSchema,
  createdAt: z.string(),
  subtotalNetCents: z.number().int(),
  deliveryFeeCents: z.number().int(),
  totalCents: z.number().int(),
  items: z.array(
    z.object({
      itemName: z.string(),
      quantity: z.number().int(),
      unitNetPriceCents: z.number().int(),
    }),
  ),
});
export type OrderTracking = z.infer<typeof orderTrackingSchema>;
