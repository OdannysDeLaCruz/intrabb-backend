/**
 * Response al iniciar un pago
 */
export interface PaymentResponse {
  success: boolean;
  externalId: string; // ID de la pasarela (wompi_transaction_id, stripe_payment_intent, etc.)
  status: 'pending' | 'approved' | 'declined' | 'error';

  // Datos para el frontend
  paymentData: {
    asyncPaymentUrl?: string | null; // URL asíncrona para PSE y BANCOLOMBIA_TRANSFER
    wompiTransactionId?: string; // ID de transacción de Wompi
    publicKey?: string; // Public key de Wompi (para tokenización)

    // Metadata adicional
    paymentMethodType: string; // CARD, NEQUI, PSE, etc.
    expiresAt?: string; // Cuándo expira la transacción
  };

  message?: string;
  errorCode?: string;
}
