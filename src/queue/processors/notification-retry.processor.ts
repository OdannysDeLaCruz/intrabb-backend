import { Process, Processor } from '@nestjs/bull';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bull';
import { NotificationQueueService, RetryJobData, CleanupJobData } from '../notification-queue/notification-queue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

@Processor('notification-retry')
export class NotificationRetryProcessor {
  private readonly logger = new Logger(NotificationRetryProcessor.name);

  constructor(
    private notificationQueueService: NotificationQueueService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  @Process('retry-notification')
  async handleRetryNotification(job: Job<RetryJobData>) {
    const { userId, event, payload, failedNotificationId, originalError } = job.data;

    this.logger.log(`Processing retry for notification ${failedNotificationId}`);

    try {
      // Usar el NotificationsService para reintentar
      const success = await this.notificationsService.retryNotification(userId, event, payload);

      if (success) {
        // Marcar como resuelto
        await this.notificationQueueService.markNotificationAsResolved(
          failedNotificationId,
          'push' // TODO: detectar el método que funcionó
        );

        this.logger.log(`✅ Notification ${failedNotificationId} successfully retried`);
      } else {
        // Programar siguiente reintento
        const hasMoreRetries = await this.notificationQueueService.scheduleNextRetry(
          failedNotificationId,
          'Retry attempt failed'
        );

        if (!hasMoreRetries) {
          this.logger.warn(`❌ Max retries reached for notification ${failedNotificationId}`);

          // Implementar escalación (SMS, email, etc.)
          await this.escalateFailedNotification(failedNotificationId, payload);
        }
      }

    } catch (error) {
      this.logger.error(`Error processing retry for notification ${failedNotificationId}:`, error);

      // Programar siguiente reintento
      await this.notificationQueueService.scheduleNextRetry(
        failedNotificationId,
        error.message
      );
    }
  }

  @Process('cleanup-old-notifications')
  async handleCleanupOldNotifications(job: Job<CleanupJobData>) {
    const { olderThanDays } = job.data;

    this.logger.log(`Starting cleanup of notifications older than ${olderThanDays} days`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.prisma.failedNotification.deleteMany({
        where: {
          is_resolved: true,
          resolved_at: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(`✅ Cleaned up ${result.count} old resolved notifications`);

      // También limpiar notificaciones muy antiguas que nunca se resolvieron
      const unresolvedCutoff = new Date();
      unresolvedCutoff.setDate(unresolvedCutoff.getDate() - (olderThanDays * 3)); // 3x más tiempo para no resueltas

      const unresolvedResult = await this.prisma.failedNotification.deleteMany({
        where: {
          is_resolved: false,
          created_at: {
            lt: unresolvedCutoff,
          },
        },
      });

      this.logger.log(`✅ Cleaned up ${unresolvedResult.count} old unresolved notifications`);

    } catch (error) {
      this.logger.error('Error during cleanup:', error);
      throw error;
    }
  }


  /**
   * Escala las notificaciones que fallaron múltiples veces
   */
  private async escalateFailedNotification(
    failedNotificationId: number,
    payload: any
  ): Promise<void> {
    try {
      // Obtener información de la notificación fallida
      const failedNotification = await this.prisma.failedNotification.findUnique({
        where: { id: failedNotificationId },
        include: { user: true },
      });

      if (!failedNotification) {
        this.logger.error(`Failed notification ${failedNotificationId} not found for escalation`);
        return;
      }

      this.logger.warn(`🚨 Escalating failed notification ${failedNotificationId} for user ${failedNotification.user_id}`);

      // Dependiendo del tipo de notificación, implementar diferentes escalaciones
      switch (payload.type) {
        case 'cotizacion_aceptada':
          // Notificación crítica - enviar SMS o email
          await this.sendCriticalEscalation(failedNotification.user, payload);
          break;

        case 'nueva_oportunidad':
          // Agregar a digest de oportunidades perdidas
          await this.addToOpportunityDigest(failedNotification.user_id, payload);
          break;

        default:
          // Log para revisión manual
          this.logger.warn(`Unhandled escalation for notification type: ${payload.type}`);
          break;
      }

    } catch (error) {
      this.logger.error(`Error escalating notification ${failedNotificationId}:`, error);
    }
  }

  /**
   * Envía escalación crítica por SMS/Email
   */
  private async sendCriticalEscalation(user: any, payload: any): Promise<void> {
    // TODO: Implementar integración con SMS/Email providers
    this.logger.log(`🔔 CRITICAL: Should send SMS/Email to ${user.phone_number || user.email} - ${payload.title}`);

    // Placeholder para futuras integraciones:
    // - Twilio para SMS
    // - SendGrid para Email
    // - WhatsApp Business API
  }

  /**
   * Agrega notificación fallida a un digest para envío posterior
   */
  private async addToOpportunityDigest(userId: string, payload: any): Promise<void> {
    this.logger.log(`📝 Adding opportunity to digest for user ${userId}: ${payload.title}`);

    // TODO: Implementar sistema de digest
    // - Acumular oportunidades perdidas
    // - Enviar digest semanal
    // - Incluir resumen de actividad
  }
}