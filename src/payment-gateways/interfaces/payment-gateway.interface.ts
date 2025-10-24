import { PaymentRequest } from './payment-request.interface';
import { PaymentResponse } from './payment-response.interface';
import { WebhookEvent } from './webhook-event.interface';

/**
 * Interfaz principal que todas las pasarelas de pago deben implementar
 * Permite cambiar entre Wompi, Stripe, PayU, etc. sin modificar la lógica de negocio
 */
export interface IPaymentGateway {
  /**
   * Nombre de la pasarela (wompi, stripe, payu, etc.)
   */
  readonly name: string;

  /**
   * Inicializa un pago y devuelve información para procesarlo
   * @param request - Datos del pago
   * @returns Datos necesarios para que el frontend complete el pago
   */
  initiatePayment(request: PaymentRequest): Promise<PaymentResponse>;

  /**
   * Verifica el estado de un pago
   * @param externalId - ID de la transacción en la pasarela
   */
  verifyPayment(externalId: string): Promise<{
    status: 'pending' | 'approved' | 'declined' | 'error';
    amount?: number;
    currency?: string;
  }>;

  /**
   * Valida la firma de un webhook
   * @param payload - Cuerpo del webhook (raw string)
   * @param signature - Firma del webhook
   */
  validateWebhookSignature(payload: string, signature: string): Promise<boolean>;

  /**
   * Parsea un evento de webhook al formato común
   * @param payload - Payload del webhook
   */
  parseWebhookEvent(payload: any): Promise<WebhookEvent>;
}
