import { Module } from '@nestjs/common';
import { CloudinaryService } from './services/cloudinary.service';
import { UploadController } from './controllers/upload.controller';

@Module({
  controllers: [UploadController],
  providers: [CloudinaryService],
  exports: [CloudinaryService]
})
export class CommonModule {}
