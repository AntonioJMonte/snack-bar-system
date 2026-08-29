import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/zod';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { MinRole } from '../auth/min-role.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ENV, type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { endOfStoreDay } from './store-clock';
import { StoreStatusService } from './store-status.service';

const overrideSchema = z.object({ open: z.boolean() });

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const scheduleEntrySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    opensAt: z.string().regex(HHMM, 'formato HH:mm'),
    closesAt: z.string().regex(HHMM, 'formato HH:mm'),
  })
  .refine((s) => s.opensAt < s.closesAt, { message: 'opensAt deve ser antes de closesAt' });
const schedulesSchema = z.object({ schedules: z.array(scheduleEntrySchema) });

const createRegionSchema = z.object({
  name: z.string().trim().min(1),
  feeCents: z.number().int().min(0),
});
const updateRegionSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    feeCents: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'nada para atualizar' });

@Controller('store')
export class StoreController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeStatus: StoreStatusService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // Público: o site usa para exibir "loja fechada". A validação que IMPEDE o
  // pedido continua na criação do pedido, no servidor (seção 5.5).
  @Get('status')
  async status() {
    return this.storeStatus.isOpenAt(new Date(), this.prisma);
  }

  // Abrir/fechar manualmente: exclusivo de gerente+ (seção 5.5). A sobreposição
  // expira ao final do dia NO FUSO DA LOJA e a loja volta ao horário programado.
  @Post('override')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @MinRole('manager')
  async setOverride(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const parsed = overrideSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'VALIDATION_ERROR' });

    const now = new Date();
    const expiresAt = endOfStoreDay(now, this.env.STORE_TIMEZONE);

    return this.prisma.$transaction(async (tx) => {
      const previous = await this.storeStatus.isOpenAt(now, tx);
      const override = await tx.storeStatusOverride.create({
        data: { open: parsed.data.open, setById: req.user.id, expiresAt },
      });
      await this.audit.record(tx, {
        userId: req.user.id,
        action: 'store.manual_override',
        entity: 'StoreStatusOverride',
        entityId: override.id,
        oldValue: { open: previous.open, source: previous.source },
        newValue: { open: parsed.data.open, expiresAt: expiresAt.toISOString() },
      });
      return override;
    });
  }

  // ——— Configurações (gerente+, seção 5.5): horários e taxas por região ———

  @Get('schedules')
  listSchedules() {
    return this.prisma.storeSchedule.findMany({ orderBy: [{ dayOfWeek: 'asc' }, { opensAt: 'asc' }] });
  }

  // Substitui a semana inteira de uma vez: o estado final é exatamente o enviado.
  @Put('schedules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @MinRole('manager')
  async replaceSchedules(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const { schedules } = parseOr400(schedulesSchema, body);
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.storeSchedule.findMany();
      await tx.storeSchedule.deleteMany();
      await tx.storeSchedule.createMany({ data: schedules });
      await this.audit.record(tx, {
        userId: req.user.id,
        action: 'store.schedule_changed',
        entity: 'StoreSchedule',
        entityId: 'week',
        oldValue: previous.map((s) => ({ dayOfWeek: s.dayOfWeek, opensAt: s.opensAt, closesAt: s.closesAt })),
        newValue: schedules,
      });
      return tx.storeSchedule.findMany({ orderBy: [{ dayOfWeek: 'asc' }, { opensAt: 'asc' }] });
    });
  }

  @Get('regions')
  listRegions() {
    return this.prisma.deliveryRegion.findMany({ orderBy: { name: 'asc' } });
  }

  @Post('regions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @MinRole('manager')
  async createRegion(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const data = parseOr400(createRegionSchema, body);
    return this.prisma.$transaction(async (tx) => {
      const region = await tx.deliveryRegion.create({ data });
      await this.audit.record(tx, {
        userId: req.user.id,
        action: 'region.created',
        entity: 'DeliveryRegion',
        entityId: region.id,
        newValue: data,
      });
      return region;
    });
  }

  @Patch('regions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @MinRole('manager')
  async updateRegion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = parseOr400(updateRegionSchema, body);
    return this.prisma.$transaction(async (tx) => {
      const region = await tx.deliveryRegion.findUnique({ where: { id } });
      if (!region) throw new NotFoundException({ code: 'REGION_NOT_FOUND', regionId: id });
      const updated = await tx.deliveryRegion.update({ where: { id }, data });
      const fields = Object.keys(data) as (keyof typeof data)[];
      await this.audit.record(tx, {
        userId: req.user.id,
        action: 'region.updated',
        entity: 'DeliveryRegion',
        entityId: id,
        oldValue: Object.fromEntries(fields.map((f) => [f, region[f]])),
        newValue: Object.fromEntries(fields.map((f) => [f, updated[f]])),
      });
      return updated;
    });
  }
}
