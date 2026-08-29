import { Module } from '@nestjs/common';
import { StoreController } from './store.controller';
import { StoreStatusService } from './store-status.service';

@Module({
  controllers: [StoreController],
  providers: [StoreStatusService],
  exports: [StoreStatusService],
})
export class StoreModule {}
