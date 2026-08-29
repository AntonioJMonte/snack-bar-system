import { Module } from '@nestjs/common';
import { MenuPublicController } from './menu-public.controller';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  controllers: [MenuPublicController, MenuController],
  providers: [MenuService],
})
export class MenuModule {}
