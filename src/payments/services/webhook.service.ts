import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentGatewayFactory } from '../../payment-gateways/payment-gateway.factory';
import { WebhookEvent } from '../../payment-gateways/interfaces/webhook-event.interface';
import { TransactionStatus, WalletTransactionType } from '@prisma/client';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gatewayFactory: PaymentGatewayFactory,
  ) {}

  /**
   * Procesa un webhook de Wompi
   */
  async processWompiWebhook(rawPayload: string, signature: string): Promise<void> {
    this.logger.log('Processing Wompi webhook');

    // 1. Parsear payload
    const payload = JSON.parse(rawPayload);

    // 2. Extraer checksums y validar que exista
    const checksumFromHeader = signature;
    const checksumFromBody = payload.signature?.checksum;
    const finalChecksum = checksumFromHeader || checksumFromBody;

    this.logger.log(`Checksum from header: ${checksumFromHeader || 'NOT_PROVIDED'}`);
    this.logger.log(`Checksum from body: ${checksumFromBody || 'NOT_PROVIDED'}`);
    this.logger.log(`Event type: ${payload.event}`);
    this.logger.log(`Transaction ID: ${payload.data?.transaction?.id}`);

    // 3. Guardar log del webhook inmediatamente
    const webhookLog = await this.prisma.wompiWebhookLog.create({
      data: {
        event_type: payload.event || 'unknown',
        wompi_event_id: payload.data?.transaction?.id,
        signature: finalChecksum || 'NOT_PROVIDED',
        signature_valid: false, // Se actualizará a true si la validación pasa
        payload: payload,
        processed: false,
        error_message: !finalChecksum ? 'CHECKSUM_NOT_PROVIDED' : null,
      },
    });

    try {
      // 4. Rechazar si no hay checksum
      if (!finalChecksum) {
        const errorMsg = 'Webhook rejected: Missing checksum (X-Event-Checksum header or signature.checksum in body)';
        this.logger.error(errorMsg);

        await this.prisma.wompiWebhookLog.update({
          where: { id: webhookLog.id },
          data: {
            signature_valid: false,
            error_message: errorMsg,
          },
        });

        throw new Error(errorMsg);
      }

      // 5. Validar firma
      const gateway = this.gatewayFactory.getGateway('wompi');
      const isValidSignature = await gateway.validateWebhookSignature(
        rawPayload,
        finalChecksum,
      );

      // Actualizar validación de firma
      await this.prisma.wompiWebhookLog.update({
        where: { id: webhookLog.id },
        data: { signature_valid: isValidSignature },
      });

      if (!isValidSignature) {
        this.logger.error('Invalid webhook signature');
        return;
      }

      // 4. Parsear evento al formato común
      const event = await gateway.parseWebhookEvent(payload);

      // 5. Procesar según el tipo de evento
      await this.processEvent(event);

      // 6. Marcar webhook como procesado
      await this.prisma.wompiWebhookLog.update({
        where: { id: webhookLog.id },
        data: {
          processed: true,
          processed_at: new Date(),
        },
      });

      this.logger.log(`Webhook processed successfully: ${event.eventType}`);
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`, error.stack);

      // Guardar error en el log
      await this.prisma.wompiWebhookLog.update({
        where: { id: webhookLog.id },
        data: {
          error_message: error.message,
          retry_count: { increment: 1 },
        },
      });

      throw error;
    }
  }

  /**
   * Procesa un evento de webhook según su tipo
   */
  private async processEvent(event: WebhookEvent): Promise<void> {
    this.logger.log(`Processing event: ${event.eventType} for transaction ${event.internalTransactionId}`);

    switch (event.eventType) {
      case 'payment.approved':
        await this.handlePaymentApproved(event);
        break;

      case 'payment.declined':
        await this.handlePaymentDeclined(event);
        break;

      case 'payment.voided':
        await this.handlePaymentVoided(event);
        break;

      case 'payment.error':
        await this.handlePaymentError(event);
        break;

      default:
        this.logger.warn(`Unhandled event type: ${event.eventType}`);
    }
  }

  /**
   * Maneja pago aprobado
   */
  private async handlePaymentApproved(event: WebhookEvent): Promise<void> {
    this.logger.log(`Payment approved: ${event.internalTransactionId}`);

    // Usar transacción de base de datos para atomicidad
    await this.prisma.$transaction(async (tx) => {
      // 1. Buscar la transacción interna
      const walletTransaction = await tx.walletTransaction.findUnique({
        where: { transaction_id: event.internalTransactionId },
        include: {
          wallet: true,
          related_service_appointment: {
            include: {
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
              commission_record: true,
            },
          },
        },
      });

      if (!walletTransaction) {
        throw new Error(`Transaction not found: ${event.internalTransactionId}`);
      }

      // 2. Verificar que esté pendiente
      if (walletTransaction.status !== TransactionStatus.pending) {
        this.logger.warn(`Transaction already processed: ${event.internalTransactionId}`);
        return;
      }

      // 3. Actualizar estado de la transacción del pago
      await tx.walletTransaction.update({
        where: { id: walletTransaction.id },
        data: { status: TransactionStatus.completed },
      });

      // 4. Acreditar fondos COMPLETOS al wallet del aliado
      await tx.wallet.update({
        where: { id: walletTransaction.wallet_id },
        data: {
          balance: {
            increment: walletTransaction.amount,
          },
        },
      });

      // 5. Cobrar comisión pendiente si existe
      if (walletTransaction.type === WalletTransactionType.payment_received &&
          walletTransaction.related_service_appointment) {

        const commissionRecord = walletTransaction.related_service_appointment.commission_record;

        if (commissionRecord) {
          // Calcular deuda pendiente de comisión
          const pendingCommission = commissionRecord.commission_amount_due - commissionRecord.commission_amount_paid;

          if (pendingCommission > 0) {
            this.logger.log(`Pending commission found: ${pendingCommission} COP`);

            // Crear WalletTransaction para cobro de comisión pendiente
            const commissionTransaction = await tx.walletTransaction.create({
              data: {
                amount: -pendingCommission,
                type: 'adjustment',
                description: `Cobro automático de comisión pendiente - Cita #${walletTransaction.related_service_appointment.id}`,
                status: 'completed',
                transaction_id: `AUTO_COMM_${walletTransaction.related_service_appointment.id}_${Date.now()}`,
                wallet_id: walletTransaction.wallet_id,
                related_service_appointment_id: walletTransaction.related_service_appointment.id,
              }
            });

            // Crear CommissionPayment
            await tx.commissionPayment.create({
              data: {
                commission_record_id: commissionRecord.id,
                amount_paid: pendingCommission,
                percentage_paid: commissionRecord.commission_percentage_due - commissionRecord.commission_percentage_paid,
                payment_method_id: 1, // wallet
                wallet_transaction_id: commissionTransaction.id,
                processed_automatically: true,
                processing_system: 'wompi_webhook',
                notes: 'Cobro automático al recibir pago del cliente',
              }
            });

            // Descontar comisión del balance
            await tx.wallet.update({
              where: { id: walletTransaction.wallet_id },
              data: {
                balance: {
                  decrement: pendingCommission,
                },
              },
            });

            // Actualizar CommissionRecord
            await tx.commissionRecord.update({
              where: { id: commissionRecord.id },
              data: {
                commission_amount_paid: commissionRecord.commission_amount_due,
                commission_percentage_paid: commissionRecord.commission_percentage_due,
                is_paid_full: true,
                payment_status: 'fully_paid',
                fully_paid_at: new Date(),
                first_payment_at: commissionRecord.first_payment_at || new Date(),
              }
            });

            this.logger.log(`Commission charged: ${pendingCommission} COP`);
          }
        }
      }

      // 6. Actualizar metadata de Wompi
      await tx.wompiPayment.updateMany({
        where: { wallet_transaction_id: walletTransaction.id },
        data: {
          finalized_at_wompi: new Date(),
        },
      });

      this.logger.log(`Funds credited to wallet: ${walletTransaction.wallet_id}, amount: ${walletTransaction.amount}`);
    });
  }

  /**
   * Maneja pago rechazado
   */
  private async handlePaymentDeclined(event: WebhookEvent): Promise<void> {
    this.logger.log(`Payment declined: ${event.internalTransactionId}`);

    await this.prisma.walletTransaction.update({
      where: { transaction_id: event.internalTransactionId },
      data: { status: TransactionStatus.failed },
    });
  }

  /**
   * Maneja pago anulado
   */
  private async handlePaymentVoided(event: WebhookEvent): Promise<void> {
    this.logger.log(`Payment voided: ${event.internalTransactionId}`);

    await this.prisma.walletTransaction.update({
      where: { transaction_id: event.internalTransactionId },
      data: { status: TransactionStatus.cancelled },
    });
  }

  /**
   * Maneja error de pago
   */
  private async handlePaymentError(event: WebhookEvent): Promise<void> {
    this.logger.error(`Payment error: ${event.internalTransactionId}`);

    await this.prisma.walletTransaction.update({
      where: { transaction_id: event.internalTransactionId },
      data: { status: TransactionStatus.failed },
    });
  }

}
