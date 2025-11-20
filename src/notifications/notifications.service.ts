import { Injectable, Logger, Inject } from '@nestjs/common';
import { IPushService } from '../push/interfaces/push.interface';
import { NotificationQueueService, NotificationPayload } from '../queue/notification-queue/notification-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { DeviceTokensService } from '../device-tokens/device-tokens.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject('IPushService') private pushService: IPushService,
    private queueService: NotificationQueueService,
    private prisma: PrismaService,
    private cacheService: CacheService, // Para verificar usuarios online
    private deviceTokensService: DeviceTokensService,
  ) {}

  /**
   * Envía notificación híbrida con sistema de reintentos robusto
   * 1. Intenta WebSocket (si está online)
   * 2. Intenta Push notification
   * 3. Si falla, guarda en cola para reintento
   */
  async sendHybridNotification(
    userId: string,
    event: string,
    payload: NotificationPayload,
    options: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      bypassWebSocket?: boolean;
      websocketCallback?: (userId: string, event: string, data: any) => Promise<boolean>;
    } = {}
  ): Promise<{
    websocket: boolean;
    push: boolean;
    success: boolean;
    queued?: boolean;
    error?: string;
  }> {
    const { priority = 'normal', bypassWebSocket = false, websocketCallback } = options;
    const result = { websocket: false, push: false, success: false, queued: false, error: null };

    try {
      // 1. Intentar WebSocket primero (si no está bypassed)
      if (!bypassWebSocket && websocketCallback) {
        const wsSuccess = await this.tryWebSocketNotification(userId, event, payload, websocketCallback);
        result.websocket = wsSuccess;

        if (wsSuccess) {
          result.success = true;
          this.logger.log(`✅ Notification sent via WebSocket to user ${userId}`);
          return result;
        }
      }

      // 2. Intentar Push notification
      const pushSuccess = await this.tryPushNotification(userId, payload);
      result.push = pushSuccess;

      if (pushSuccess) {
        result.success = true;
        this.logger.log(`✅ Notification sent via Push to user ${userId}`);
        return result;
      }

      // 3. Si ambos fallan, guardar en cola para reintento
      const error = 'Both WebSocket and Push notifications failed';
      await this.queueService.saveFailedNotification(userId, event, payload, error, priority);

      result.queued = true;
      result.error = error;
      this.logger.warn(`⚠️ Notification queued for retry: ${userId} - ${payload.title}`);

      return result;

    } catch (error) {
      this.logger.error(`❌ Error in hybrid notification for user ${userId}:`, error);

      // Guardar en cola incluso si hay error general
      try {
        await this.queueService.saveFailedNotification(userId, event, payload, error.message, priority);
        result.queued = true;
      } catch (queueError) {
        this.logger.error(`❌ Failed to queue notification:`, queueError);
      }

      result.error = error.message;
      return result;
    }
  }

  /**
   * Intenta envío por WebSocket usando callback del AppGateway
   */
  private async tryWebSocketNotification(
    userId: string,
    event: string,
    payload: NotificationPayload,
    websocketCallback: (userId: string, event: string, data: any) => Promise<boolean>
  ): Promise<boolean> {
    try {
      // Verificar si el usuario está online usando Redis
      const isOnline = await this.isUserOnline(userId);

      if (!isOnline) {
        this.logger.debug(`User ${userId} is not online for WebSocket`);
        return false;
      }

      // Usar el callback del AppGateway para enviar por WebSocket
      const success = await websocketCallback(userId, event, payload);

      if (success) {
        this.logger.debug(`📡 WebSocket notification sent to ${userId}`);
      }

      return success;

    } catch (error) {
      this.logger.error(`WebSocket notification failed for ${userId}:`, error);
      return false;
    }
  }

  /**
   * Verifica si un usuario está online (usando la misma lógica del AppGateway)
   */
  async isUserOnline(userId: string): Promise<boolean> {
    try {
      return await this.cacheService.exists(`online_aliado:${userId}`);
    } catch (error) {
      this.logger.error(`Error checking online status for ${userId}:`, error);
      return false;
    }
  }

  /**
   * Intenta envío por Push notification
   */
  private async tryPushNotification(
    userId: string,
    payload: NotificationPayload
  ): Promise<boolean> {
    try {
      // Obtener tokens activos del usuario
      const tokens = await this.deviceTokensService.getActiveTokensForUser(userId);
      console.log(`📱 TOKENS activos para ${userId}:`, tokens);
      if (tokens.length === 0) {
        this.logger.warn(`No active FCM tokens found for user ${userId}`);
        return false;
      }

      const fcmTokens = tokens.map(token => token.fcm_token);
      console.log(`📱 TOKENS para ${userId}:`, fcmTokens);
      // Enviar notificación push
      const response = await this.pushService.sendPushNotification(fcmTokens, {
        title: payload.title,
        body: payload.body,
        data: payload.data,
        imageUrl: payload.imageUrl,
      });

      console.log(`📱 Push notification response for user ${userId}:`, response);

      // Manejar tokens inválidos
      if (response.failureCount > 0) {
        await this.handleFailedTokens(response, fcmTokens);
      }

      const success = response.successCount > 0;

      if (success) {
        this.logger.debug(`📱 Push notification sent to ${response.successCount}/${fcmTokens.length} devices for user ${userId}`);
      }

      return success;

    } catch (error) {
      this.logger.error(`Push notification failed for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Obtiene tokens activos por usuario
   */


  /**
   * Maneja tokens que fallaron al enviar
   */
  private async handleFailedTokens(response: any, tokens: string[]) {
    console.log('handlerFailedTokens')
    const failedTokens: string[] = [];

    response.responses.forEach((resp, idx) => {
      console.log(resp)
      // Marcar tokens inválidos para desactivación
      if (!resp.success && resp.error) {
        // Códigos de error que indican token inválido
        const invalidTokenCodes = [
          'messaging/registration-token-not-registered', // Firebase
          'INCOMPATIBLE_TOKEN', // Nuestro código para tokens incompatibles
          'DeviceNotRegistered', // Expo
          'InvalidCredentials' // Expo
        ];

        if (invalidTokenCodes.includes(resp.error.code) ||
            resp.error.message?.includes('not registered') ||
            resp.error.message?.includes('invalid')) {
          failedTokens.push(tokens[idx]);
        }
      }
    });

    // Desactivar tokens inválidos (puede haber múltiples usuarios con el mismo token)
    for (const token of failedTokens) {
      try {
        const result = await this.prisma.deviceToken.updateMany({
          where: { fcm_token: token },
          data: { is_active: false },
        });

        this.logger.log(`🗑️ Deactivated ${result.count} invalid token(s): ${token.substring(0, 20)}...`);
      } catch (error) {
        this.logger.error(`Error deactivating token: ${error.message}`);
      }
    }
  }

  /**
   * Envía notificación a múltiples usuarios
   */
  async sendNotificationToMultipleUsers(
    userIds: string[],
    event: string,
    payload: NotificationPayload,
    options: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      batchSize?: number;
      websocketCallback?: (userId: string, event: string, data: any) => Promise<boolean>;
    } = {}
  ): Promise<{ sent: number; failed: number; queued: number }> {
    const { priority = 'normal', batchSize = 10, websocketCallback } = options;
    const results = { sent: 0, failed: 0, queued: 0 };

    // Procesar en batches para evitar sobrecarga
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      const batchPromises = batch.map(async (userId) => {
        try {
          const result = await this.sendHybridNotification(userId, event, payload, {
            priority,
            websocketCallback
          });

          if (result.success) {
            results.sent++;
          } else if (result.queued) {
            results.queued++;
          } else {
            results.failed++;
          }
        } catch (error) {
          this.logger.error(`Failed to send notification to user ${userId}:`, error);
          results.failed++;
        }
      });

      await Promise.allSettled(batchPromises);

      // Pequeña pausa entre batches
      if (i + batchSize < userIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.logger.log(`📊 Bulk notification completed: ${results.sent} sent, ${results.failed} failed, ${results.queued} queued`);
    return results;
  }

  /**
   * Reintenta una notificación específica (llamado por el processor)
   */
  async retryNotification(
    userId: string,
    event: string,
    payload: NotificationPayload,
    websocketCallback?: (userId: string, event: string, data: any) => Promise<boolean>
  ): Promise<boolean> {
    this.logger.debug(`🔄 Retrying notification for user ${userId}`);

    try {
      const result = await this.sendHybridNotification(userId, event, payload, {
        bypassWebSocket: false,
        websocketCallback,
      });

      return result.success;
    } catch (error) {
      this.logger.error(`Retry failed for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Obtiene estadísticas del sistema de notificaciones
   */
  async getNotificationMetrics() {
    const queueStats = await this.queueService.getQueueStats();

    const tokenStats = await this.prisma.deviceToken.groupBy({
      by: ['is_active'],
      _count: { id: true },
    });

    const recentFailures = await this.prisma.failedNotification.count({
      where: {
        created_at: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Últimas 24 horas
        },
      },
    });

    return {
      queue: queueStats,
      tokens: {
        active: tokenStats.find(s => s.is_active)?._count.id || 0,
        inactive: tokenStats.find(s => !s.is_active)?._count.id || 0,
      },
      failures_24h: recentFailures,
    };
  }
}
