/**
 * Request para iniciar un pago
 */
export interface PaymentRequest {
  amount: number;
  currency: string;
  transactionId: string; // ID interno (WalletTransaction.transaction_id)
  customerEmail: string;
  customerPhone?: string;
  customerName?: string;
  description: string;
  paymentMethodType: 'CARD' | 'NEQUI' | 'PSE' | 'BANCOLOMBIA_TRANSFER';
  paymentMethodDetails:
    | CardPaymentMethod
    | NequiPaymentMethod
    | PsePaymentMethod
    | BancolombiaTransferPaymentMethod;
  metadata?: Record<string, any>;
}

// Tipos específicos por método de pago
export interface CardPaymentMethod {
  type: 'CARD';
  token: string; // Token de tarjeta tokenizada
  installments: number; // Número de cuotas (1 = sin cuotas)
}

export interface NequiPaymentMethod {
  type: 'NEQUI';
  phoneNumber: string; // Sin +57, ejemplo: "3001234567"
}

export interface PsePaymentMethod {
  type: 'PSE';
  userType: 0 | 1; // 0 = Persona Natural, 1 = Persona Jurídica
  userLegalIdType: string; // "CC", "NIT", "CE", etc.
  userLegalId: string; // Número de documento
  financialInstitutionCode: string; // Código del banco
  paymentDescription: string;
}

export interface BancolombiaTransferPaymentMethod {
  type: 'BANCOLOMBIA_TRANSFER';
  paymentDescription: string;
  ecommerceUrl?: string; // URL de retorno personalizada
}
