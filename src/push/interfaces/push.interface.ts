/**
 * Interfaz para servicios de notificaciones push
 *
 * Esta abstracción permite cambiar fácilmente el proveedor de notificaciones
 * (Expo, FCM, OneSignal, etc.) sin afectar el resto del código
 */

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
}

export interface PushNotificationResponse {
  successCount: number;
  failureCount: number;
  responses: Array<{
    success: boolean;
    messageId?: string;
    error?: {
      message: string;
      code?: string;
      details?: any;
    };
  }>;
}

export interface IPushService {
  /**
   * Envía notificación push a uno o múltiples dispositivos
   */
  sendPushNotification(
    tokens: string | string[],
    payload: PushNotificationPayload
  ): Promise<PushNotificationResponse>;

  /**
   * Valida si un token es válido para este servicio
   */
  validateToken(token: string): Promise<boolean>;

  /**
   * Verifica si un token es compatible con este servicio
   */
  isCompatibleToken(token: string): boolean;
}