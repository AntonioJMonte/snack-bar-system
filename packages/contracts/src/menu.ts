import { z } from 'zod';

// Resposta de GET /menu (cardápio público, seção 5.1).

export const menuAddonSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  priceCents: z.number().int().min(0),
});
export type MenuAddon = z.infer<typeof menuAddonSchema>;

export const menuItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  priceCents: z.number().int().min(0),
  discountPercent: z.number().int().min(0).max(100),
  photoUrl: z.string().nullable(),
  soldOut: z.boolean(),
  addons: z.array(menuAddonSchema),
});
export type MenuItem = z.infer<typeof menuItemSchema>;

export const menuCategorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  items: z.array(menuItemSchema),
});
export type MenuCategory = z.infer<typeof menuCategorySchema>;

export const menuSchema = z.array(menuCategorySchema);
export type Menu = z.infer<typeof menuSchema>;
