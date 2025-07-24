import { Module } from '@nestjs/common';
import { ServiceCategoriesService } from './service_categories.service';
import { ServiceCategoriesController } from './service_categories.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheModule } from 'src/cache/cache.module';

@Module({
  imports: [CacheModule],
  controllers: [ServiceCategoriesController],
  providers: [ServiceCategoriesService, PrismaService],
})
export class ServiceCategoriesModule {}
