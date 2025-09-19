import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationQueueService } from './notification-queue/notification-queue.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'notification-retry',
    }),
    BullModule.registerQueue({
      name: 'notification-cleanup',
    }),
    PrismaModule,
  ],
  providers: [NotificationQueueService],
  exports: [NotificationQueueService, BullModule],
})
export class QueueModule {}
