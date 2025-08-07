import { Module } from '@nestjs/common';
import { ServiceRequestController } from './service_request.controller';
import { ServiceRequestService } from './service_request.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { AppGateway } from '../app/app.gateway';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [ServiceRequestController],
  providers: [ServiceRequestService, AppGateway],
  exports: [ServiceRequestService]
})
export class ServiceRequestModule {}
