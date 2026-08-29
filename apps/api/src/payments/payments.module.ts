import { Module } from '@nestjs/common';
import { MercadoPagoClient } from './gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsScheduler } from './payments.scheduler';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, MercadoPagoClient, PaymentsScheduler],
})
export class PaymentsModule {}
