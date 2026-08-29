import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { PanelModule } from './panel/panel.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { StoreModule } from './store/store.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    // Emissor interno do NestJS (seção 10.1): o evento `order.paid`
    // (PDF: pedido.pago) é publicado pelo módulo de pagamentos.
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    AuthModule,
    AuditModule,
    StoreModule,
    MenuModule,
    OrdersModule,
    PanelModule,
    PaymentsModule,
    UsersModule,
  ],
})
export class AppModule {}
