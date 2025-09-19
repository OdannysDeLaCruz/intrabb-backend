import { Module } from '@nestjs/common';
import { CommissionSettingsService } from './commission-settings.service';
import { CommissionSettingsController } from './commission-settings.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [CommissionSettingsService, PrismaService],
  controllers: [CommissionSettingsController],
  exports: [CommissionSettingsService],
})
export class CommissionSettingsModule {}
