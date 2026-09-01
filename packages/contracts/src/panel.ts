import { z } from 'zod';
import { roleSchema } from './common';
import { orderSchema } from './orders';

// GET /panel/orders — pedidos ativos (pagos e ainda não concluídos), ordem de chegada.
export const panelOrdersSchema = z.array(orderSchema);

// POST /panel/orders/:id/status — um passo por vez (decisão #19).
export const advanceStatusRequestSchema = z.object({
  status: z.enum(['preparing', 'ready', 'out_for_delivery', 'completed']),
});
export type AdvanceStatusRequest = z.infer<typeof advanceStatusRequestSchema>;

// POST /panel/heartbeat — sinal de vida a cada 30s (seção 8.2).
export const heartbeatRequestSchema = z.object({
  device: z.string().trim().min(1).max(100),
  soundArmed: z.boolean(),
});
export type HeartbeatRequest = z.infer<typeof heartbeatRequestSchema>;

// GET /panel/sessions — painéis ativos (seção 5.7), gerente+.
export const panelSessionSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  device: z.string(),
  soundArmed: z.boolean(),
  lastHeartbeatAt: z.string(),
  active: z.boolean(),
  user: z.object({ name: z.string(), role: roleSchema }),
});
export type PanelSession = z.infer<typeof panelSessionSchema>;
export const panelSessionsSchema = z.array(panelSessionSchema);
