import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { VerifiableDocumentsService } from './verifiable_documents.service';
import { IntrabblersService } from '../intrabblers/intrabblers.service';
import { Public, SkipPlatform } from '../common/decorators';
import { Request } from 'express';
import * as crypto from 'crypto';

interface RequestWithRawBody extends Request {
  rawBody?: string;
}

interface DiditWebhookPayload {
  decision?: {
    id_verification: {
      front_image?: string;
      back_image?: string;
    };
    liveness?: {
      reference_image?: string;
    };
  };
  session_id: string;
  status: string;
  vendor_data: string;
}

@Controller('verifiable_documents')
export class VerifiableDocumentsController {
  constructor(
    private readonly verifiableDocumentsService: VerifiableDocumentsService,
    private readonly intrabblersService: IntrabblersService,
  ) {}

  @Get(':userId')
  async findByUserId(
    @Param('userId') userId: string,
    @Query('document_type') documentType?: string,
  ) {
    try {
      // Validar que el userId sea un UUID válido
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      if (!uuidRegex.test(userId)) {
        throw new HttpException(
          'Invalid user ID format',
          HttpStatus.BAD_REQUEST,
        );
      }

      const documents = await this.verifiableDocumentsService.findByUserId(
        userId,
        documentType,
      );

      return {
        success: true,
        data: documents,
        message: documentType
          ? `Documents of type '${documentType}' retrieved successfully`
          : 'All documents retrieved successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Error retrieving verifiable documents',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('notifications/webhooks/didit')
  @Public()
  @SkipPlatform()
  async handleDiditWebhook(
    @Req() req: RequestWithRawBody,
    @Headers('x-signature') signature: string,
    @Headers('x-timestamp') timestamp: string,
    @Body() body: any,
  ) {
    try {
      const WEBHOOK_SECRET_KEY = process.env.DIDIT_WEBHOOK_SECRET_KEY;
      console.log('signature', signature);
      console.log('timestamp', timestamp);
      // console.log('body', body);
      console.log('req.body', req.rawBody);
      // Ensure all required data is present
      if (!signature || !timestamp || !req.rawBody || !WEBHOOK_SECRET_KEY) {
        console.log('No signature, timestamp, or rawBody');
        throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      }

      // Validate the timestamp to ensure the request is fresh (within 5 minutes)
      const currentTime = Math.floor(Date.now() / 1000);
      const incomingTime = parseInt(timestamp, 10);
      if (Math.abs(currentTime - incomingTime) > 300) {
        throw new HttpException(
          'Request timestamp is stale',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Generate an HMAC from the raw body using the shared secret
      const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET_KEY);
      const expectedSignature = hmac.update(req.rawBody).digest('hex');

      // Compare using timingSafeEqual for security
      const expectedSignatureBuffer = Buffer.from(expectedSignature, 'utf8');
      const providedSignatureBuffer = Buffer.from(signature, 'utf8');

      if (
        expectedSignatureBuffer.length !== providedSignatureBuffer.length ||
        !crypto.timingSafeEqual(expectedSignatureBuffer, providedSignatureBuffer)
      ) {
        throw new HttpException(
          `Invalid signature. Computed (${expectedSignature}), Provided (${signature})`,
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Parse the JSON and proceed (signature is valid at this point)
      const webhookData: DiditWebhookPayload = body;

      console.log('=== DIDIT WEBHOOK RECEIVED ===');
      console.log('Session ID:', webhookData.session_id);  
      console.log('Status:', webhookData.status);
      console.log('Vendor Data:', webhookData.vendor_data);
      console.log('=== END DIDIT WEBHOOK ===');

      // Process webhook data asynchronously without waiting
      this.processWebhookData(webhookData).catch((error) => {
        console.error('Error processing webhook data:', error);
      });

      // Respond immediately to Didit
      return {
        success: true,
        message: 'Webhook event dispatched',
      };
    } catch (error) {
      console.error('Error in Didit webhook handler:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
  }

  private async processWebhookData(data: DiditWebhookPayload): Promise<void> {
    try {
      console.log('=== PROCESSING WEBHOOK DATA ===');
      
      // 3. Obtener ID de usuario (vendor_data)
      const userId = data.vendor_data;
      console.log('Processing for user ID:', userId);

      // 4. Buscar usuario en base de datos
      const user = await this.verifiableDocumentsService.findUserById(userId);
      if (!user) {
        console.error(`User with ID ${userId} not found in database`);
        return;
      }

      // console.log('User found:', user.name, user.lastname);

      // 5. Verificar si viene el atributo decision
      if (!data.decision) {
        console.log('No decision data in webhook');
        return;
      }

      // Mapear status de Didit a DocumentStatus
      const documentStatus = this.mapDiditStatusToDocumentStatus(data.status);
      console.log('Mapped status:', data.status, '->', documentStatus);

      const documentsToCreate = [];
      let selfieUrl: string | null = null;

      // 6. Procesar front_image y back_image
      if (data.decision.id_verification?.front_image) {
        documentsToCreate.push({
          documentTypeName: 'identity_card_front_side',
          documentUrl: data.decision.id_verification.front_image,
          status: documentStatus,
        });
      }

      if (data.decision.id_verification?.back_image) {
        documentsToCreate.push({
          documentTypeName: 'identity_card_back_side',
          documentUrl: data.decision.id_verification.back_image,
          status: documentStatus,
        });
      }

      // 7. Procesar selfie (reference_image)
      if (data.decision.liveness?.reference_image) {
        selfieUrl = data.decision.liveness.reference_image;
        documentsToCreate.push({
          documentTypeName: 'selfie',
          documentUrl: selfieUrl,
          status: documentStatus,
        });
      }

      // Crear todos los documentos
      for (const docData of documentsToCreate) {
        try {
          await this.verifiableDocumentsService.createVerifiableDocument({
            userId,
            documentTypeName: docData.documentTypeName,
            documentUrl: docData.documentUrl,
            status: docData.status,
            verificationChannel: 'didit',
            diditSessionId: data.session_id,
          });
          console.log(`Created document: ${docData.documentTypeName}`);
        } catch (error) {
          console.error(`Error creating document ${docData.documentTypeName}:`, error);
        }
      }

      // Si el documento fue aprobado, aprobar también el perfil del intrabbler
      if (documentStatus === 'Approved') {
        try {
          await this.intrabblersService.approveProfile(userId);
          console.log(`Profile approved for user: ${userId}`);

          // Si hay selfie URL, actualizar photo_url del usuario
          if (selfieUrl) {
            await this.verifiableDocumentsService.updateUserPhotoUrl(userId, selfieUrl);
            console.log(`Updated photo_url for user: ${userId} with selfie: ${selfieUrl}`);
          }
        } catch (error) {
          console.error(`Error approving profile for user ${userId}:`, error);
          // No lanzar error para no afectar el flujo principal del webhook
        }
      }

      console.log('=== WEBHOOK PROCESSING COMPLETED ===');
    } catch (error) {
      console.error('Error in processWebhookData:', error);
      throw error;
    }
  }

  private mapDiditStatusToDocumentStatus(diditStatus: string): string {
    // 8. Mapear estados de Didit a DocumentStatus
    switch (diditStatus.toLowerCase()) {
      case 'in review':
        return 'InReview';
      case 'approved':
        return 'Approved';
      case 'declined':
      case 'rejected':
        return 'Declined';
      case 'abandoned':
        return 'Abandoned';
      default:
        console.warn(`Unknown Didit status: ${diditStatus}, defaulting to InReview`);
        return 'InReview';
    }
  }
}