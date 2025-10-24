import { Controller, Post, 
  Headers, 
  HttpCode, 
  RawBodyRequest, 
  Req 
} from '@nestjs/common';
import { 
  Request
} from 'express';

import { WebhookService } from '../services/webhook.service';
import { Public, SkipPlatform } from 'src/common/decorators';

@Controller('payments/webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Endpoint para recibir webhooks de Wompi
   * IMPORTANTE: Este endpoint NO debe tener autenticación JWT
   */
  @Post('wompi')
  @Public()
  @SkipPlatform()
  @HttpCode(200)
  async handleWompiWebhook(
    @Headers('x-event-checksum') checksum: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    console.log('🔔 Webhook received at:', new Date().toISOString());

    // IMPORTANTE: Necesitamos el body RAW (sin parsear) para validar la firma
    const rawBody = req.rawBody?.toString('utf-8') || JSON.stringify(req.body);

    // Fire and forget - procesar en background sin bloquear la respuesta
    // Wompi requiere respuesta en max 200ms
    this.webhookService.processWompiWebhook(rawBody, checksum)
      .catch(error => {
        // El error ya se loguea en el servicio, solo asegurar que no crashee la app
        console.error('Webhook processing failed:', error);
      });

    // Responder inmediatamente a Wompi
    return { received: true };
  }
}
