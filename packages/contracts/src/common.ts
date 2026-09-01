import { z } from 'zod';

// Enums espelhando o schema Prisma (nomes em inglês — decisão #4).
export const channelSchema = z.enum(['web', 'whatsapp']);
export type Channel = z.infer<typeof channelSchema>;

export const orderStatusSchema = z.enum([
  'pending_payment',
  'awaiting_acceptance',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const deliveryTypeSchema = z.enum(['pickup', 'delivery']);
export type DeliveryType = z.infer<typeof deliveryTypeSchema>;

export const roleSchema = z.enum(['attendant', 'manager', 'admin']);
export type Role = z.infer<typeof roleSchema>;

// Formato de erro da API (BadRequest/Unprocessable dos controllers).
// Campos opcionais: erros do Nest sem corpo customizado também passam.
export const apiErrorSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  details: z.unknown().optional(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
