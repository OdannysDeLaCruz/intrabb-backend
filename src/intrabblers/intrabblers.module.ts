import { Module } from '@nestjs/common';
import { IntrabblersController } from './intrabblers.controller';
import { IntrabblersService } from './intrabblers.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [IntrabblersController],
  providers: [IntrabblersService],
  exports: [IntrabblersService],
})
export class IntrabblersModule {}