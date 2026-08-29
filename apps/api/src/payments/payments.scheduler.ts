import { Inject, Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ENV, type Env } from '../config/env';
import { PaymentsService } from './payments.service';

// Rede de segurança contra webhooks perdidos (seção 9.2), rodando a cada 60s
// sobre pedidos pendentes há mais de 5 minutos. Em teste fica desligada: os e2e
// chamam reconcilePendingOrders diretamente.
@Injectable()
export class PaymentsScheduler {
  constructor(
    private readonly paymentsService: PaymentsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Interval(60_000)
  async reconcile() {
    if (this.env.NODE_ENV === 'test') return;
    await this.paymentsService.reconcilePendingOrders(5);
  }
}
