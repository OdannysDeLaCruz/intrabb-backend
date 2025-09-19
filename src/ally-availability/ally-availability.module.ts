import { Module } from '@nestjs/common';
import { AllyAvailabilityService } from './ally-availability.service';
import { AllyAvailabilityController } from './ally-availability.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [AllyAvailabilityService, PrismaService],
  controllers: [AllyAvailabilityController],
  exports: [AllyAvailabilityService],
})
export class AllyAvailabilityModule {}
