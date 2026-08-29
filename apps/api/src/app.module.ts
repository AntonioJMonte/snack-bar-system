import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from './config/config.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { StoreModule } from './store/store.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    // Emissor interno do NestJS (seção 10.1): ponto de extensão onde o evento
    // `order.paid` (PDF: pedido.pago) será publicado na entrega do pagamento.
    EventEmitterModule.forRoot(),
    StoreModule,
    OrdersModule,
  ],
})
export class AppModule {}
