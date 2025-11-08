import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR;

    // Detectar errores de multer por statusCode 413 (Payload Too Large)
    if (status === HttpStatus.PAYLOAD_TOO_LARGE || exception.message?.includes('File too large')) {
      // Intentar obtener el nombre del archivo capturado en fileFilter
      let fileName = 'desconocido';
      let fieldName = 'desconocido';

      const uploadedFileInfo = (request as any).uploadedFileInfo;
      if (uploadedFileInfo && Object.keys(uploadedFileInfo).length > 0) {
        const firstField = Object.keys(uploadedFileInfo)[0];
        fileName = uploadedFileInfo[firstField].originalname;
        fieldName = firstField;
      }

      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: `El archivo "${fileName}" excede el tamaño máximo permitido de 5MB`,
        error: 'FILE_TOO_LARGE',
        field: fieldName,
        fileName: fileName
      });
    }

    // Dejar otros errores con su comportamiento normal
    if (exception.getResponse) {
      return response.status(status).json(exception.getResponse());
    }

    response.status(status).json({
      statusCode: status,
      message: 'Error interno del servidor'
    });
  }
}
