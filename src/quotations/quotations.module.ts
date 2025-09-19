import { Module } from '@nestjs/common';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AppGateway } from '../app/app.gateway';
import { CacheModule } from '../cache/cache.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, CacheModule, NotificationsModule],
  controllers: [QuotationsController],
  providers: [QuotationsService, AppGateway],
  exports: [QuotationsService]
})
export class QuotationsModule {}
