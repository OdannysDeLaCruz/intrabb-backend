import { Module } from '@nestjs/common';
import { ServiceRequestController } from './service_request.controller';
import { ServiceRequestService } from './service_request.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ServiceRequestController],
  providers: [ServiceRequestService],
  exports: [ServiceRequestService]
})
export class ServiceRequestModule {}
