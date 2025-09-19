import { Module, forwardRef } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PushModule } from '../push/push.module';
import { QueueModule } from '../queue/queue.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { DeviceTokensModule } from '../device-tokens/device-tokens.module';
import { NotificationRetryProcessor } from '../queue/processors/notification-retry.processor';

@Module({
  imports: [PushModule, forwardRef(() => QueueModule), PrismaModule, CacheModule, DeviceTokensModule],
  providers: [NotificationsService, NotificationRetryProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
