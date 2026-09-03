import { Inject, Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ENV, type Env } from '../config/env';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from './payments.service';

// Rede de segurança contra webhooks perdidos (seção 9.2), rodando a cada 60s
// sobre pedidos pendentes há mais de 5 minutos. Em teste fica desligada: os e2e
// chamam os dois métodos diretamente.
@Injectable()
export class PaymentsScheduler {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly ordersService: OrdersService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Interval(60_000)
  async reconcile() {
    if (this.env.NODE_ENV === 'test') return;
    // A expiração vem ANTES: é ela que impede o pedido abandonado de continuar
    // ocupando os 50 slots da reconciliação (decisão #34).
    await this.ordersService.expireAbandonedOrders();
    await this.paymentsService.reconcilePendingOrders(5);
  }
}
