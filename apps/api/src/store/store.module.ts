import { Module } from '@nestjs/common';
import { StoreStatusService } from './store-status.service';

@Module({
  providers: [StoreStatusService],
  exports: [StoreStatusService],
})
export class StoreModule {}
