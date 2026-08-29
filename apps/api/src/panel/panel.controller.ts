import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { MinRole } from '../auth/min-role.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DomainError } from '../common/domain-error';
import { parseOr400 } from '../common/zod';
import { OrdersService } from '../orders/orders.service';
import { PanelService } from './panel.service';

const heartbeatSchema = z.object({
  device: z.string().trim().min(1).max(100),
  soundArmed: z.boolean(),
});

// Aceite fica de fora: tem endpoint próprio, que registra quem/quando.
const advanceStatusSchema = z.object({
  status: z.enum(['preparing', 'ready', 'out_for_delivery', 'completed']),
});

// Painel de produção (seção 8): módulo de SAÍDA — não conhece nenhum canal de
// entrada (seção 13); fala apenas com o backend.
@Controller('panel')
@UseGuards(JwtAuthGuard, RolesGuard)
@MinRole('attendant')
export class PanelController {
  constructor(
    private readonly panelService: PanelService,
    private readonly ordersService: OrdersService,
  ) {}

  // Lista consultada por polling de 5–10s (decisão do PDF, seção 3).
  // Pedidos ativos em ordem de chegada; telefone do cliente incluído (seção 5.6).
  @Get('orders')
  listActiveOrders() {
    return this.panelService.listActiveOrders();
  }

  @Post('orders/:id/accept')
  async accept(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    try {
      return await this.ordersService.acceptOrder(req.user.id, id);
    } catch (error) {
      if (error instanceof DomainError && error.code === 'ORDER_NOT_FOUND') {
        throw new NotFoundException({ code: error.code, details: error.details });
      }
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

  @Post('orders/:id/status')
  async advanceStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const { status } = parseOr400(advanceStatusSchema, body);
    try {
      return await this.ordersService.advanceStatus(req.user.id, id, status);
    } catch (error) {
      if (error instanceof DomainError && error.code === 'ORDER_NOT_FOUND') {
        throw new NotFoundException({ code: error.code, details: error.details });
      }
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

  // Sinal de vida a cada 30s (seção 8.2); estado do som sempre explícito.
  @Post('heartbeat')
  heartbeat(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const data = parseOr400(heartbeatSchema, body);
    return this.panelService.heartbeat(req.user.id, data.device, data.soundArmed);
  }

  // Painéis ativos (seção 5.7): quais dispositivos estão vivos e desde quando.
  @Get('sessions')
  @MinRole('manager')
  listSessions() {
    return this.panelService.listSessions();
  }
}
