import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { CloudinaryService } from '../services/cloudinary.service';
import { GenerateSignatureDto } from '../dto/generate-signature.dto';

@Controller('upload')
export class UploadController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('signature')
  // @Public() // Descomenta si necesitas que sea público
  generateSignature(@Body() body: GenerateSignatureDto) {
    try {
      const folder = body.folder || 'service-requests';
      console.log('OK 1')
      const signatureData = this.cloudinaryService.generateUploadSignature(folder);
      console.log('OK 2')
      
      return {
        success: true,
        data: signatureData,
        message: 'Signature generada exitosamente'
      };
    } catch (error) {
      console.log(':::::::::::::::');
      console.log(error);
      throw new HttpException(
        {
          success: false,
          message: 'Error generando signature de upload',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}