/**
 * Formato común para eventos de webhook (independiente de la pasarela)
 */
export interface WebhookEvent {
  eventType:
    | 'payment.approved'
    | 'payment.declined'
    | 'payment.pending'
    | 'payment.voided'
    | 'payment.error';
  externalId: string; // ID de la pasarela
  internalTransactionId: string; // Nuestro transaction_id (viene en reference)
  status: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  metadata?: Record<string, any>;
  rawPayload: any; // Payload original para auditoría
}
