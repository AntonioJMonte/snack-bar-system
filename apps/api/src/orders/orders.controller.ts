import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MinRole } from '../auth/min-role.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DomainError } from '../common/domain-error';
import { parseOr400 } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';
import { createOrderSchema } from './dto/create-order.schema';
import { OrdersService } from './orders.service';

const historyQuerySchema = z.object({
  status: z
    .enum([
      'pending_payment',
      'awaiting_acceptance',
      'accepted',
      'preparing',
      'ready',
      'out_for_delivery',
      'completed',
      'expired',
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly prisma: PrismaService,
  ) {}

  // Lista de pedidos do painel administrativo (seção 5.7): o registro definitivo
  // da operação, incluindo os já concluídos — o `GET /panel/orders` mostra só os
  // ativos. Gerente+, mesmo nível dos relatórios.
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @MinRole('manager')
  history(@Query() query: Record<string, string>) {
    const { status, limit } = parseOr400(historyQuerySchema, query);
    return this.prisma.order.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { items: { include: { addons: true } }, payments: true },
    });
  }

  // Acompanhamento pelo cliente (seção 5.1): público, acessível só por quem tem
  // o UUID (não enumerável — decisão #9). Sem dados de outros clientes.
  @Get(':id/tracking')
  async tracking(@Param('id', ParseUUIDPipe) id: string) {
    const order = await this.ordersService.findForTracking(id);
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
    return order;
  }

  // Rota pública de maior valor para o cliente e maior exposição: limite próprio
  // (decisão #35). 60/min por IP porque o CGNAT das operadoras móveis faz dezenas
  // de clientes distintos saírem pelo MESMO IP numa sexta à noite.
  @Post()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async create(
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Chave ausente ou fora do formato não bloqueia o pedido: o canal que não
    // manda chave continua funcionando como antes (compatibilidade).
    const idempotencyKey = idempotencyKeyHeader?.trim();
    const usableKey =
      idempotencyKey && idempotencyKey.length > 0 && idempotencyKey.length <= 100
        ? idempotencyKey
        : undefined;

    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }

    try {
      const { order, reused } = await this.ordersService.create(parsed.data, usableKey);
      // 200 quando o pedido já existia: o cliente que clicou duas vezes recebe o
      // MESMO pedido, e a resposta diz que nada novo foi criado.
      res.status(reused ? 200 : 201);
      return order;
    } catch (error) {
      if (error instanceof DomainError) {
        throw new UnprocessableEntityException({
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        });
      }
      throw error;
    }
  }
}
