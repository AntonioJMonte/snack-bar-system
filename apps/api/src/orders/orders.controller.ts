import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DomainError } from '../common/domain-error';
import { createOrderSchema } from './dto/create-order.schema';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Acompanhamento pelo cliente (seção 5.1): público, acessível só por quem tem
  // o UUID (não enumerável — decisão #9). Sem dados de outros clientes.
  @Get(':id/tracking')
  async tracking(@Param('id', ParseUUIDPipe) id: string) {
    const order = await this.ordersService.findForTracking(id);
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
    return order;
  }

  @Post()
  async create(@Body() body: unknown) {
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
      return await this.ordersService.create(parsed.data);
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
