import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentGatewayFactory } from '../../payment-gateways/payment-gateway.factory';
import { AppointmentStatus, TransactionStatus, WalletTransactionType } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gatewayFactory: PaymentGatewayFactory,
  ) {}

  /**
   * Inicia el pago de un servicio completado
   */
  async initiateServicePayment(
    appointmentId: number,
    userId: string,
    customerEmail: string,
    paymentMethod: string,
    paymentMethodDetails?: any,
  ) {
    this.logger.log(`Initiating service payment for appointment ${appointmentId}`);

    // 1. Validar appointment
    const appointment = await this.prisma.serviceAppointment.findUnique({
      where: { id: appointmentId },
      include: {
        client: true,
        intrabbler: {
          include: {
            wallet: true,
          },
        },
        quotation: {
          include: {
            estimated_price: true,
          },
        },
        application: true,
        service_request: {
          include: {
            service_category: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Service appointment not found');
    }

    // Verificar que el usuario sea el cliente
    console.log(appointment.client_id, userId);
    if (appointment.client_id !== userId) {
      throw new BadRequestException('You are not authorized to pay for this service');
    }

    // Verificar que el servicio esté completado
    if (appointment.status !== AppointmentStatus.completed) {
      throw new BadRequestException('Service must be completed before payment');
    }

    // 2. Verificar si ya existe un pago pendiente o completado
    // Permitir reintentos solo si la transacción anterior falló
    const existingTransaction = await this.prisma.walletTransaction.findFirst({
      where: {
        related_service_appointment_id: appointmentId,
        type: WalletTransactionType.payment_received,
        status: {
          in: [TransactionStatus.pending, TransactionStatus.completed],
        },
      },
    });

    if (existingTransaction) {
      throw new BadRequestException('Payment already exists for this service');
    }

    // 3. Obtener el registro de comisión (snapshot creado cuando se creó la cita)
    const commissionRecord = await this.prisma.commissionRecord.findUnique({
      where: { service_appointment_id: appointmentId },
    });

    if (!commissionRecord) {
      throw new BadRequestException('Commission record not found for this appointment');
    }

    const serviceAmount = this.calculateServiceAmount(appointment);
    const commissionAmount = commissionRecord.commission_amount_due;
    const commissionPercentage = commissionRecord.commission_percentage_due;

    this.logger.log(
      `Service amount: ${serviceAmount} COP, Commission: ${commissionAmount} COP (${commissionPercentage}%)`,
    );

    // 4. Crear WalletTransaction
    const transactionId = this.generateTransactionId('PAY', appointmentId);

    const walletTransaction = await this.prisma.walletTransaction.create({
      data: {
        transaction_id: transactionId,
        amount: serviceAmount,
        type: WalletTransactionType.payment_received,
        status: TransactionStatus.pending,
        description: `Payment for service: ${appointment.service_request.service_category.name}`,
        wallet_id: appointment.intrabbler.wallet.id,
        related_service_appointment_id: appointmentId,
      },
    });

    // 5. Validar datos del método de pago
    this.validatePaymentMethodDetails(paymentMethod, paymentMethodDetails);

    // 6. Usar la pasarela activa
    const gateway = this.gatewayFactory.getActiveGateway();

    try {
      // Construir PaymentRequest según el método de pago
      const paymentRequest = await this.buildPaymentRequest(
        paymentMethod,
        paymentMethodDetails,
        serviceAmount,
        walletTransaction.transaction_id,
        appointment,
        customerEmail,
      );

      const paymentResponse = await gateway.initiatePayment(paymentRequest);

      // 6. Guardar referencia externa de Wompi
      if (paymentResponse.success) {
        await this.prisma.wompiPayment.create({
          data: {
            wallet_transaction_id: walletTransaction.id,
            wompi_transaction_id: paymentResponse.externalId,
            wompi_reference: transactionId,
            payment_method_type: paymentMethod,
            async_payment_url: paymentResponse.paymentData.asyncPaymentUrl,
            customer_email: customerEmail,
            customer_phone: appointment.client.phone_number,
            raw_response: paymentResponse as any,
          },
        });
      }

      return {
        success: true,
        data: {
          transactionId: walletTransaction.transaction_id,
          wompiTransactionId: paymentResponse.externalId,
          amount: serviceAmount,
          currency: 'COP',
          gateway: gateway.name,
          status: paymentResponse.status,
          asyncPaymentUrl: paymentResponse.paymentData.asyncPaymentUrl,
          expiresAt: paymentResponse.paymentData.expiresAt,
        },
      };
    } catch (error) {
      // Si falla la creación en la pasarela, marcar transacción como fallida
      await this.prisma.walletTransaction.update({
        where: { id: walletTransaction.id },
        data: { status: TransactionStatus.failed },
      });

      throw error;
    }
  }

  /**
   * Tokeniza una tarjeta usando Wompi
   */
  async tokenizeCard(cardData: {
    number: string;
    cvc: string;
    exp_month: string;
    exp_year: string;
    card_holder: string;
  }) {
    const gateway = this.gatewayFactory.getActiveGateway() as any;

    if (!gateway.wompiApiService) {
      throw new BadRequestException('Card tokenization not supported by current gateway');
    }

    try {
      const wompiResponse = await gateway.wompiApiService.tokenizeCard(cardData);

      return {
        success: true,
        data: {
          token: wompiResponse.data.id,
          status: wompiResponse.data.status,
          createdAt: wompiResponse.data.created_at,
        },
      };
    } catch (error) {
      this.logger.error(`Error tokenizing card: ${error.message}`);
      throw new BadRequestException('Failed to tokenize card');
    }
  }

  /**
   * Obtiene la lista de métodos de pago disponibles
   */
  async getPaymentMethods() {
    const methods = await this.prisma.paymentMethod.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        is_active: true,
        url_icon: true,
        is_visible_in_app: true,
      },
      where: {
        is_visible_in_app: true,
        is_active: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    return {
      success: true,
      data: {
        methods: methods.map((method) => ({
          id: method.id,
          code: method.code,
          name: method.name,
          description: method.description,
          isActive: method.is_active,
          urlIcon: method.url_icon,
          isVisibleInApp: method.is_visible_in_app,
        })),
      },
    };
  }

  /**
   * Obtiene el estado de una transacción por su ID (para polling)
   * Solo consulta el estado actual en Wompi, NO modifica la BD (eso lo hace el webhook)
   */
  async getTransactionStatus(transactionId: string, userId: string) {
    const transaction = await this.prisma.walletTransaction.findFirst({
      where: {
        transaction_id: transactionId,
      },
      include: {
        wompi_payment: true,
        payment_method: true,
        related_service_appointment: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Verificar que el usuario sea el cliente del servicio
    if (transaction.related_service_appointment?.client_id !== userId) {
      throw new BadRequestException('You are not authorized to view this transaction');
    }

    // Si hay wompi_payment, consultar estado actualizado en Wompi (solo lectura)
    if (transaction.wompi_payment) {
      const gateway = this.gatewayFactory.getActiveGateway();
      const wompiStatus = await gateway.verifyPayment(
        transaction.wompi_payment.wompi_transaction_id,
      );

      return {
        success: true,
        data: {
          transactionId: transaction.transaction_id,
          wompiTransactionId: transaction.wompi_payment.wompi_transaction_id,
          dbStatus: transaction.status, // Estado en nuestra BD
          wompiStatus: wompiStatus.status, // Estado actual en Wompi
          amount: transaction.amount,
          currency: 'COP',
          asyncPaymentUrl: transaction.wompi_payment.async_payment_url,
          paymentMethodType: transaction.wompi_payment.payment_method_type,
          createdAt: transaction.created_at,
          updatedAt: transaction.updated_at,
        },
      };
    }

    return {
      success: true,
      data: {
        transactionId: transaction.transaction_id,
        status: transaction.status,
        amount: transaction.amount,
        currency: 'COP',
        createdAt: transaction.created_at,
        updatedAt: transaction.updated_at,
      },
    };
  }

  /**
   * Obtiene el estado de un pago de servicio
   */
  async getServicePaymentStatus(appointmentId: number) {
    const transaction = await this.prisma.walletTransaction.findFirst({
      where: {
        related_service_appointment_id: appointmentId,
        type: WalletTransactionType.payment_received,
      },
      include: {
        wompi_payment: true,
        payment_method: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Payment not found for this service');
    }

    return {
      success: true,
      data: {
        status: transaction.status,
        amount: transaction.amount,
        transactionId: transaction.transaction_id,
        createdAt: transaction.created_at,
        updatedAt: transaction.updated_at,
        paymentMethod: transaction.payment_method?.name,
      },
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private calculateServiceAmount(appointment: any): number {
    // Para quotation_based
    if (appointment.quotation) {
      return appointment.quotation.estimated_price.estimated_total;
    }

    // Para fixed_price
    if (appointment.application) {
      return parseFloat(appointment.service_request.amount);
    }

    throw new BadRequestException('Cannot calculate service amount');
  }

  private generateTransactionId(prefix: string, appointmentId: number): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ITB-${prefix}-${appointmentId}-${timestamp}-${random}`;
  }

  private validatePaymentMethodDetails(
    paymentMethod: string,
    details: any,
  ): void {
    switch (paymentMethod) {
      case 'CARD':
        if (!details?.cardToken) {
          throw new BadRequestException('Card token is required for CARD payment');
        }
        break;

      case 'NEQUI':
        if (!details?.phoneNumber) {
          throw new BadRequestException('Phone number is required for NEQUI payment');
        }
        break;

      case 'PSE':
        if (
          !details?.userType ||
          !details?.userLegalIdType ||
          !details?.userLegalId ||
          !details?.financialInstitutionCode ||
          !details?.paymentDescription
        ) {
          throw new BadRequestException(
            'PSE payment requires: userType, userLegalIdType, userLegalId, financialInstitutionCode, and paymentDescription',
          );
        }
        break;

      case 'BANCOLOMBIA_TRANSFER':
        if (!details?.paymentDescription) {
          throw new BadRequestException(
            'Payment description is required for BANCOLOMBIA_TRANSFER',
          );
        }
        break;

      default:
        throw new BadRequestException(`Unsupported payment method: ${paymentMethod}`);
    }
  }

  private mapGatewayStatusToTransaction(
    gatewayStatus: 'pending' | 'approved' | 'declined' | 'error',
  ): TransactionStatus {
    switch (gatewayStatus) {
      case 'approved':
        return TransactionStatus.completed;
      case 'declined':
        return TransactionStatus.failed;
      case 'error':
        return TransactionStatus.failed;
      case 'pending':
      default:
        return TransactionStatus.pending;
    }
  }

  private async buildPaymentRequest(
    paymentMethod: string,
    details: any,
    amount: number,
    transactionId: string,
    appointment: any,
    customerEmail: string,
  ): Promise<any> {
    // Obtener acceptance_token
    const gateway = this.gatewayFactory.getActiveGateway() as any;
    const acceptanceToken = await gateway.wompiApiService.getAcceptanceToken();

    const amountInCents = Math.round(amount * 100);
    const customerData = {
      phone_number: appointment.client.phone_number || '',
      full_name: `${appointment.client.name} ${appointment.client.lastname}`,
    };

    // Construir payment_method según el tipo
    let paymentMethodData: any;

    switch (paymentMethod) {
      case 'CARD':
        paymentMethodData = {
          type: 'CARD',
          token: details.cardToken,
          installments: details.installments || 1,
        };
        break;

      case 'NEQUI':
        paymentMethodData = {
          type: 'NEQUI',
          phone_number: details.phoneNumber,
        };
        break;

      case 'PSE':
        paymentMethodData = {
          type: 'PSE',
          user_type: details.userType,
          user_legal_id_type: details.userLegalIdType,
          user_legal_id: details.userLegalId,
          financial_institution_code: details.financialInstitutionCode,
          payment_description: details.paymentDescription,
        };
        // PSE no requiere signature, pero sí acceptance_token
        return {
          acceptance_token: acceptanceToken,
          amount_in_cents: amountInCents,
          currency: 'COP',
          customer_email: customerEmail,
          reference: transactionId,
          payment_method: paymentMethodData,
          customer_data: customerData,
        };

      case 'BANCOLOMBIA_TRANSFER':
        paymentMethodData = {
          type: 'BANCOLOMBIA_TRANSFER',
          payment_description: details.paymentDescription,
          user_type: 'PERSON',
        };
        break;

      default:
        throw new BadRequestException(`Unsupported payment method: ${paymentMethod}`);
    }

    // Para CARD, NEQUI, BANCOLOMBIA_TRANSFER: requieren signature
    const signature = this.generateSignature(transactionId, amountInCents);

    return {
      acceptance_token: acceptanceToken,
      amount_in_cents: amountInCents,
      currency: 'COP',
      signature: signature,
      customer_email: customerEmail,
      reference: transactionId,
      payment_method: paymentMethodData,
    };
  }

  private generateSignature(reference: string, amountInCents: number): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto');
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;

    if (!integritySecret) {
      throw new BadRequestException('WOMPI_INTEGRITY_SECRET not configured');
    }

    // Formato correcto de Wompi: {reference}{amount_in_cents}{currency}{integrity_secret}
    const concatenated = `${reference}${amountInCents}COP${integritySecret}`;

    this.logger.debug(`Signature data: reference=${reference}, amount=${amountInCents}, secret=${integritySecret.substring(0, 4)}...`);

    return crypto.createHash('sha256').update(concatenated).digest('hex');
  }
}
