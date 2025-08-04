import { Module } from '@nestjs/common';
import { IntrabblersController } from './intrabblers.controller';
import { IntrabblersService } from './intrabblers.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IntrabblersController],
  providers: [IntrabblersService],
  exports: [IntrabblersService],
})
export class IntrabblersModule {}