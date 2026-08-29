import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { MinRole } from '../auth/min-role.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { parseOr400 } from '../common/zod';
import { MenuService } from './menu.service';

const priceSchema = z.object({ priceCents: z.number().int().positive() });
// 0–100 validado aqui E pela restrição CHECK do banco (seção 11).
const discountSchema = z.object({ discountPercent: z.number().int().min(0).max(100) });
const soldOutSchema = z.object({ soldOut: z.boolean() });

const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  displayOrder: z.number().int().min(0),
});
const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    displayOrder: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'nada para atualizar' });

const createItemSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().max(500).optional(),
  priceCents: z.number().int().positive(),
  discountPercent: z.number().int().min(0).max(100).default(0),
  photoUrl: z.url().optional(),
  categoryId: z.uuid(),
  addons: z
    .array(z.object({ name: z.string().trim().min(1), priceCents: z.number().int().min(0) }))
    .default([]),
});
const updateItemSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    photoUrl: z.url().nullable().optional(),
    active: z.boolean().optional(),
    categoryId: z.uuid().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'nada para atualizar' });

const createAddonSchema = z.object({
  name: z.string().trim().min(1),
  priceCents: z.number().int().min(0),
});
const updateAddonSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    priceCents: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'nada para atualizar' });

@Controller('menu')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // ——— Cadastro (gerente+, seção 5.5) ———

  @Post('categories')
  @MinRole('manager')
  createCategory(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    return this.menuService.createCategory(req.user.id, parseOr400(createCategorySchema, body));
  }

  @Patch('categories/:id')
  @MinRole('manager')
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.menuService.updateCategory(req.user.id, id, parseOr400(updateCategorySchema, body));
  }

  @Post('items')
  @MinRole('manager')
  createItem(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    return this.menuService.createItem(req.user.id, parseOr400(createItemSchema, body));
  }

  @Patch('items/:id')
  @MinRole('manager')
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.menuService.updateItem(req.user.id, id, parseOr400(updateItemSchema, body));
  }

  @Post('items/:id/addons')
  @MinRole('manager')
  createAddon(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.menuService.createAddon(req.user.id, id, parseOr400(createAddonSchema, body));
  }

  @Patch('addons/:id')
  @MinRole('manager')
  updateAddon(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.menuService.updateAddon(req.user.id, id, parseOr400(updateAddonSchema, body));
  }

  // ——— Operações pontuais ———

  // Alterar preço é operação financeira: gerente+ (seção 5.5).
  @Patch('items/:id/price')
  @MinRole('manager')
  updatePrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const { priceCents } = parseOr400(priceSchema, body);
    return this.menuService.updatePrice(req.user.id, id, priceCents);
  }

  @Patch('items/:id/discount')
  @MinRole('manager')
  updateDiscount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const { discountPercent } = parseOr400(discountSchema, body);
    return this.menuService.updateDiscount(req.user.id, id, discountPercent);
  }

  // Marcar esgotado é operação do dia a dia: atendente+ (seção 5.5).
  @Patch('items/:id/sold-out')
  @MinRole('attendant')
  setSoldOut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const { soldOut } = parseOr400(soldOutSchema, body);
    return this.menuService.setSoldOut(req.user.id, id, soldOut);
  }
}
