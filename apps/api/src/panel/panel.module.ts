import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PanelController } from './panel.controller';
import { PanelService } from './panel.service';

@Module({
  imports: [OrdersModule],
  controllers: [PanelController],
  providers: [PanelService],
})
export class PanelModule {}
