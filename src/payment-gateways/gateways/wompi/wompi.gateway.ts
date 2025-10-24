import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IPaymentGateway } from '../../interfaces/payment-gateway.interface';
import { PaymentRequest } from '../../interfaces/payment-request.interface';
import { PaymentResponse } from '../../interfaces/payment-response.interface';
import { WebhookEvent } from '../../interfaces/webhook-event.interface';
import { WompiApiService } from './wompi-api.service';
import * as crypto from 'crypto';

@Injectable()
export class WompiGateway implements IPaymentGateway {
  readonly name = 'wompi';
  private readonly logger = new Logger(WompiGateway.name);

  constructor(
    private readonly wompiApiService: WompiApiService,
    private readonly configService: ConfigService,
  ) {}

  async initiatePayment(request: any): Promise<PaymentResponse> {
    try {
      this.logger.log(
        `Initiating payment for transaction: ${request.reference}`,
      );

      // El payload ya viene construido desde el servicio
      const wompiResponse =
        await this.wompiApiService.createTransaction(request);

      // Normalizar respuesta
      return this.normalizeWompiResponse(wompiResponse, request);
    } catch (error) {
      this.logger.error(
        `Error initiating payment: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        externalId: null,
        status: 'error',
        paymentData: {
          paymentMethodType: request.payment_method?.type,
        },
        message: error.message,
        errorCode: error.code || 'WOMPI_API_ERROR',
      };
    }
  }

  async verifyPayment(externalId: string): Promise<{
    status: 'pending' | 'approved' | 'declined' | 'error';
    amount?: number;
    currency?: string;
  }> {
    try {
      const transaction =
        await this.wompiApiService.getTransaction(externalId);

      return {
        status: this.mapWompiStatus(transaction.status),
        amount: transaction.amount_in_cents / 100,
        currency: transaction.currency,
      };
    } catch (error) {
      this.logger.error(`Error verifying payment: ${error.message}`);
      return { status: 'error' };
    }
  }

  async validateWebhookSignature(
    payload: string,
    signature: string,
  ): Promise<boolean> {
    try {
      const secret = this.configService.get<string>('WOMPI_WEBHOOK_SECRET');
      const event = JSON.parse(payload);

      // Paso 1: Extraer properties del evento
      const properties = event.signature?.properties || [];

      // Paso 2: Concatenar valores de los properties desde event.data
      let concatenatedString = '';
      for (const prop of properties) {
        const value = this.getNestedProperty(event.data, prop);
        concatenatedString += value !== undefined ? value : '';
      }

      // Paso 3: Concatenar timestamp
      concatenatedString += event.timestamp;

      // Paso 4: Concatenar secret
      concatenatedString += secret;

      // Paso 5: Generar checksum con SHA256 (no HMAC)
      const computed = crypto
        .createHash('sha256')
        .update(concatenatedString)
        .digest('hex')
        .toUpperCase();

      // Paso 6: Comparar con el checksum del evento
      const eventChecksum = event.signature?.checksum || signature;

      this.logger.debug(`Computed checksum: ${computed}`);
      this.logger.debug(`Event checksum: ${eventChecksum}`);

      return computed === eventChecksum.toUpperCase();
    } catch (error) {
      this.logger.error(
        `Error validating webhook signature: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Obtiene el valor de una propiedad anidada del objeto
   * Ejemplo: 'transaction.id' => event.data.transaction.id
   */
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  async parseWebhookEvent(payload: any): Promise<WebhookEvent> {
    const transaction = payload.data?.transaction;

    if (!transaction) {
      throw new Error('Invalid webhook payload: missing transaction data');
    }

    const eventType = this.mapWompiEventType(
      payload.event,
      transaction.status,
    );

    return {
      eventType,
      externalId: transaction.id,
      internalTransactionId: transaction.reference,
      status: transaction.status,
      amount: transaction.amount_in_cents / 100,
      currency: transaction.currency,
      paymentMethod: transaction.payment_method_type,
      metadata: transaction.customer_data,
      rawPayload: payload,
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private buildWompiPayload(
    request: PaymentRequest,
    acceptanceToken: string,
  ): any {
    const basePayload = {
      acceptance_token: acceptanceToken,
      amount_in_cents: Math.round(request.amount * 100),
      currency: request.currency,
      customer_email: request.customerEmail,
      reference: request.transactionId,
      customer_data: {
        phone_number: request.customerPhone || '',
        full_name: request.customerName || '',
      },
    };

    // Agregar payment_method según el tipo
    const paymentMethod = this.buildPaymentMethod(request);

    return {
      ...basePayload,
      payment_method: paymentMethod,
    };
  }

  private buildPaymentMethod(request: PaymentRequest): any {
    const details = request.paymentMethodDetails as any;

    switch (details.type) {
      case 'CARD':
        return {
          type: 'CARD',
          token: details.token,
          installments: details.installments,
        };

      case 'NEQUI':
        return {
          type: 'NEQUI',
          phone_number: details.phoneNumber,
        };

      case 'PSE':
        return {
          type: 'PSE',
          user_type: details.userType,
          user_legal_id_type: details.userLegalIdType,
          user_legal_id: details.userLegalId,
          financial_institution_code: details.financialInstitutionCode,
          payment_description: details.paymentDescription,
        };

      case 'BANCOLOMBIA_TRANSFER':
        return {
          type: 'BANCOLOMBIA_TRANSFER',
          payment_description: details.paymentDescription,
          ...(details.ecommerceUrl && {
            ecommerce_url: details.ecommerceUrl,
          }),
        };

      default:
        throw new Error(`Unsupported payment method: ${details.type}`);
    }
  }

  private normalizeWompiResponse(
    wompiResponse: any,
    request: any,
  ): PaymentResponse {
    const data = wompiResponse.data;

    return {
      success: true,
      externalId: data.id,
      status: this.mapWompiStatus(data.status),
      paymentData: {
        asyncPaymentUrl: data.async_payment_url || null,
        wompiTransactionId: data.id,
        // publicKey: this.configService.get<string>('WOMPI_PUBLIC_KEY'),
        paymentMethodType: request.payment_method?.type,
        expiresAt: data.expires_at,
      },
    };
  }

  private mapWompiStatus(
    wompiStatus: string,
  ): 'pending' | 'approved' | 'declined' | 'error' {
    switch (wompiStatus) {
      case 'PENDING':
        return 'pending';
      case 'APPROVED':
        return 'approved';
      case 'DECLINED':
        return 'declined';
      case 'VOIDED':
        return 'declined';
      case 'ERROR':
        return 'error';
      default:
        return 'pending';
    }
  }

  private mapWompiEventType(
    event: string,
    status: string,
  ): WebhookEvent['eventType'] {
    if (event === 'transaction.updated') {
      switch (status) {
        case 'APPROVED':
          return 'payment.approved';
        case 'DECLINED':
          return 'payment.declined';
        case 'VOIDED':
          return 'payment.voided';
        case 'ERROR':
          return 'payment.error';
        default:
          return 'payment.pending';
      }
    }
    return 'payment.pending';
  }
}
