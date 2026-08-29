import { z } from 'zod';
import { normalizeBrazilianPhone } from '../../common/phone';

// Campos desconhecidos (preço, desconto, total…) são REMOVIDOS pelo Zod (modo strip):
// valores vindos do cliente são ignorados, não lidos — exigência da seção 5.4.

const orderItemInputSchema = z.object({
  itemId: z.uuid(),
  quantity: z.number().int().positive(),
  note: z.string().trim().max(500).optional(),
  addonIds: z.array(z.uuid()).default([]),
});

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
