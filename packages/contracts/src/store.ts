import { z } from 'zod';

// GET /store/status — informativo no site; a validação que IMPEDE o pedido é a
// da criação do pedido no servidor (seção 5.5).
export const storeStatusSchema = z.object({
  open: z.boolean(),
  source: z.enum(['manual', 'scheduled']),
});
export type StoreStatus = z.infer<typeof storeStatusSchema>;

// GET /store/regions — o site só oferece regiões ativas.
export const deliveryRegionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  feeCents: z.number().int().min(0),
  active: z.boolean(),
});
export type DeliveryRegion = z.infer<typeof deliveryRegionSchema>;

// GET /store/schedules — exibição do horário de funcionamento.
export const storeScheduleSchema = z.object({
  id: z.uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  opensAt: z.string(),
  closesAt: z.string(),
});
export type StoreSchedule = z.infer<typeof storeScheduleSchema>;
