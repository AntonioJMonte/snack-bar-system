import { z } from 'zod';

// POST /payments/checkout/:orderId → URL do ambiente do gateway (10.3): o
// servidor nunca vê dados de cartão; o cliente é redirecionado ao initPoint.
export const checkoutResponseSchema = z.object({
  initPoint: z.string(),
});
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;
