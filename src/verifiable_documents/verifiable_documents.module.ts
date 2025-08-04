import { Module } from '@nestjs/common';
import { VerifiableDocumentsService } from './verifiable_documents.service';
import { VerifiableDocumentsController } from './verifiable_documents.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { IntrabblersModule } from '../intrabblers/intrabblers.module';

@Module({
  imports: [PrismaModule, IntrabblersModule],
  controllers: [VerifiableDocumentsController],
  providers: [VerifiableDocumentsService],
  exports: [VerifiableDocumentsService],
})
export class VerifiableDocumentsModule {}