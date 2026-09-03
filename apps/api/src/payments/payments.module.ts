import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { MercadoPagoClient } from './gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsScheduler } from './payments.scheduler';
import { PaymentsService } from './payments.service';

@Module({
  // OrdersModule entra pela expiração agendada (decisão #34); a relação é de mão
  // única — orders não conhece payments.
  imports: [OrdersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, MercadoPagoClient, PaymentsScheduler],
})
export class PaymentsModule {}
