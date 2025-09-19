import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  type?: 'nueva_oportunidad' | 'cotizacion_aceptada' | 'mensaje' | 'recordatorio';
}

export interface RetryJobData {
  userId: string;
  event: string;
  payload: NotificationPayload;
  failedNotificationId: number;
  originalError: string;
}

export interface CleanupJobData {
  olderThanDays: number;
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(
    @InjectQueue('notification-retry') private retryQueue: Queue<RetryJobData>,
    @InjectQueue('notification-cleanup') private cleanupQueue: Queue<CleanupJobData>,
    private prisma: PrismaService,
  ) {}

  /**
   * Guarda una notificación fallida y la programa para reintento
   * TEMPORALMENTE DESACTIVADO PARA TESTING
   */
  async saveFailedNotification(
    userId: string,
    event: string,
    payload: NotificationPayload,
    error: string,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
  ): Promise<void> {
    // TEMPORARILY DISABLED - Solo log el error sin guardar ni programar reintentos
    this.logger.warn(`🚫 RETRY DISABLED - Notification failed for user ${userId}: ${error}`);
    return;

    // CÓDIGO ORIGINAL COMENTADO:
    /*
    try {
      // Calcular cuando hacer el próximo reintento (exponential backoff)
      const nextRetryAt = this.calculateNextRetry(0);

      // Guardar en base de datos
      const failedNotification = await this.prisma.failedNotification.create({
        data: {
          user_id: userId,
          notification_type: payload.type || 'unknown',
          event,
          payload: payload as any,
          last_error: error,
          next_retry_at: nextRetryAt,
          priority,
          max_attempts: this.getMaxAttemptsByPriority(priority),
        },
      });

      // Programar job en cola con delay
      const delay = nextRetryAt.getTime() - Date.now();
      await this.scheduleRetryJob(failedNotification.id, userId, event, payload, error, delay);

      this.logger.log(`Failed notification saved and scheduled for retry: ${failedNotification.id}`);
    } catch (saveError) {
      this.logger.error('Failed to save failed notification:', saveError);
    }
    */
  }

  /**
   * Programa un job de reintento
   */
  private async scheduleRetryJob(
    failedNotificationId: number,
    userId: string,
    event: string,
    payload: NotificationPayload,
    originalError: string,
    delay: number = 0
  ): Promise<void> {
    const jobData: RetryJobData = {
      userId,
      event,
      payload,
      failedNotificationId,
      originalError,
    };

    const jobOptions = {
      delay: Math.max(delay, 0),
      attempts: 1, // Bull no debe reintentar, nosotros gestionamos los reintentos
      removeOnComplete: 10, // Mantener últimos 10 jobs exitosos
      removeOnFail: 50, // Mantener últimos 50 jobs fallidos
    };

    await this.retryQueue.add('retry-notification', jobData, jobOptions);
  }

  /**
   * Marca una notificación como exitosa
   */
  async markNotificationAsResolved(
    failedNotificationId: number,
    method: 'websocket' | 'push' | 'sms' | 'email'
  ): Promise<void> {
    await this.prisma.failedNotification.update({
      where: { id: failedNotificationId },
      data: {
        is_resolved: true,
        resolved_at: new Date(),
        resolved_method: method,
      },
    });

    this.logger.log(`Notification ${failedNotificationId} marked as resolved via ${method}`);
  }

  /**
   * Actualiza el reintento fallido y programa el siguiente
   */
  async scheduleNextRetry(
    failedNotificationId: number,
    error: string
  ): Promise<boolean> {
    const failedNotification = await this.prisma.failedNotification.findUnique({
      where: { id: failedNotificationId },
    });

    if (!failedNotification) {
      this.logger.error(`Failed notification not found: ${failedNotificationId}`);
      return false;
    }

    const newAttempts = failedNotification.attempts + 1;

    if (newAttempts >= failedNotification.max_attempts) {
      // Máximo de intentos alcanzado
      await this.prisma.failedNotification.update({
        where: { id: failedNotificationId },
        data: {
          attempts: newAttempts,
          last_error: `Max attempts reached: ${error}`,
        },
      });

      this.logger.warn(`Max attempts reached for notification ${failedNotificationId}`);
      return false;
    }

    // Calcular siguiente reintento con exponential backoff
    const nextRetryAt = this.calculateNextRetry(newAttempts);

    await this.prisma.failedNotification.update({
      where: { id: failedNotificationId },
      data: {
        attempts: newAttempts,
        last_error: error,
        next_retry_at: nextRetryAt,
      },
    });

    // Programar siguiente reintento
    const delay = nextRetryAt.getTime() - Date.now();
    await this.scheduleRetryJob(
      failedNotificationId,
      failedNotification.user_id,
      failedNotification.event,
      failedNotification.payload as unknown as NotificationPayload,
      error,
      delay
    );

    this.logger.log(`Scheduled retry ${newAttempts}/${failedNotification.max_attempts} for notification ${failedNotificationId}`);
    return true;
  }

  /**
   * Calcula el delay para el próximo reintento usando exponential backoff
   */
  private calculateNextRetry(attempt: number): Date {
    // Exponential backoff: 1min, 5min, 30min, 2h, 8h
    const delays = [
      1 * 60 * 1000,      // 1 minuto
      5 * 60 * 1000,      // 5 minutos
      30 * 60 * 1000,     // 30 minutos
      2 * 60 * 60 * 1000, // 2 horas
      8 * 60 * 60 * 1000, // 8 horas
    ];

    const delayMs = delays[Math.min(attempt, delays.length - 1)];
    return new Date(Date.now() + delayMs);
  }

  /**
   * Obtiene el máximo de intentos según la prioridad
   */
  private getMaxAttemptsByPriority(priority: string): number {
    switch (priority) {
      case 'critical': return 5;
      case 'high': return 4;
      case 'normal': return 3;
      case 'low': return 2;
      default: return 3;
    }
  }

  /**
   * Programa limpieza periódica de notificaciones resueltas antiguas
   */
  async scheduleCleanup(olderThanDays: number = 7): Promise<void> {
    const jobData: CleanupJobData = { olderThanDays };

    await this.cleanupQueue.add('cleanup-old-notifications', jobData, {
      repeat: { cron: '0 2 * * *' }, // Ejecutar diariamente a las 2 AM
      removeOnComplete: 5,
      removeOnFail: 5,
    });

    this.logger.log(`Scheduled daily cleanup of notifications older than ${olderThanDays} days`);
  }

  /**
   * Obtiene estadísticas de la cola
   */
  async getQueueStats() {
    const [retryStats, cleanupStats] = await Promise.all([
      this.retryQueue.getJobCounts(),
      this.cleanupQueue.getJobCounts(),
    ]);

    const dbStats = await this.prisma.failedNotification.groupBy({
      by: ['is_resolved'],
      _count: { id: true },
    });

    return {
      queues: {
        retry: retryStats,
        cleanup: cleanupStats,
      },
      database: {
        pending: dbStats.find(s => !s.is_resolved)?._count.id || 0,
        resolved: dbStats.find(s => s.is_resolved)?._count.id || 0,
      },
    };
  }

  /**
   * Obtiene notificaciones pendientes de reintento
   */
  async getPendingRetries(limit: number = 10) {
    return this.prisma.failedNotification.findMany({
      where: {
        is_resolved: false,
        next_retry_at: { lte: new Date() },
      },
      orderBy: { next_retry_at: 'asc' },
      take: limit,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }
}
