import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { PanelModule } from './panel/panel.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { StoreModule } from './store/store.module';
import { UsersModule } from './users/users.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggingThrottlerGuard } from './common/logging-throttler.guard';

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
    HealthModule,
    StoreModule,
    MenuModule,
    OrdersModule,
    PanelModule,
    PaymentsModule,
    UsersModule,
    // Um throttler nomeado `default` (decisão #35): as rotas que precisam de
    // número próprio sobrescrevem com @Throttle({ default: {...} }). Vários
    // throttlers nomeados se aplicariam TODOS a TODAS as rotas, obrigando a
    // pendurar @SkipThrottle em cada handler — mais peça para dar errado.
    //
    // 120/min por IP é o piso do painel: PC e celular da loja saem pelo mesmo
    // NAT, e o polling de 6s dá 10 req/min por aparelho. Com os 20 originais,
    // dois aparelhos já estouravam e o painel parava de atualizar no pico.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      // Desligado nos testes (decisão #35): a suíte passava por MARGEM (12 de 20
      // chamadas no arquivo de pagamentos) e o próximo teste escrito quebraria
      // com um 429 disfarçado de bug de pagamento. O e2e dedicado religa com
      // THROTTLE_E2E=1 para exercitar a configuração de propósito.
      skipIf: () => process.env.NODE_ENV === 'test' && process.env.THROTTLE_E2E !== '1',
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: LoggingThrottlerGuard,
    },
  ],
})
export class AppModule {}
