import { Module } from '@nestjs/common';
import { ServiceCategoriesService } from './service_categories.service';
import { ServiceCategoriesController } from './service_categories.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ServiceCategoriesController],
  providers: [ServiceCategoriesService, PrismaService],
})
export class ServiceCategoriesModule {}
