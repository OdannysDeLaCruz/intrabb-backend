import { Injectable, Logger } from '@nestjs/common';
import { IPushService, PushNotificationPayload, PushNotificationResponse } from '../interfaces/push.interface';

interface ExpoPushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
}

interface ExpoPushApiResponse {
  data: Array<{
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: any;
  }>;
}

@Injectable()
export class ExpoPushService implements IPushService {
  private readonly logger = new Logger(ExpoPushService.name);
  private readonly EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  async sendPushNotification(
    tokens: string | string[],
    payload: PushNotificationPayload
  ): Promise<PushNotificationResponse> {
    try {
      const tokenArray = Array.isArray(tokens) ? tokens : [tokens];

      // Filtrar solo tokens compatibles
      const compatibleTokens = tokenArray.filter(token => this.isCompatibleToken(token));

      if (compatibleTokens.length === 0) {
        this.logger.warn('No compatible Expo tokens found');
        return {
          successCount: 0,
          failureCount: tokenArray.length,
          responses: tokenArray.map(() => ({
            success: false,
            error: {
              message: 'Token is not compatible with Expo Push Service',
              code: 'INCOMPATIBLE_TOKEN'
            }
          }))
        };
      }

      if (compatibleTokens.length < tokenArray.length) {
        this.logger.warn(`Filtered ${tokenArray.length - compatibleTokens.length} incompatible tokens`);
      }

      const messages: ExpoPushMessage[] = compatibleTokens.map(token => ({
        to: token,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      }));

      this.logger.debug(`📤 Sending ${messages.length} Expo push notifications`);

      const response = await fetch(this.EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        throw new Error(`Expo Push API error: ${response.status} ${response.statusText}`);
      }

      const result: ExpoPushApiResponse = await response.json();

      return this.parseExpoResponse(result, compatibleTokens);

    } catch (error) {
      this.logger.error('❌ Error sending Expo push notification:', error);

      const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
      return {
        successCount: 0,
        failureCount: tokenArray.length,
        responses: tokenArray.map(() => ({
          success: false,
          error: {
            message: error.message || 'Unknown error sending push notification',
            code: 'SEND_ERROR'
          }
        }))
      };
    }
  }

  private parseExpoResponse(result: ExpoPushApiResponse, tokens: string[]): PushNotificationResponse {
    let successCount = 0;
    let failureCount = 0;
    const responses: PushNotificationResponse['responses'] = [];

    result.data.forEach((item, index) => {
      if (item.status === 'ok') {
        successCount++;
        responses.push({
          success: true,
          messageId: item.id
        });
      } else {
        failureCount++;
        responses.push({
          success: false,
          error: {
            message: item.message || 'Unknown error',
            code: 'EXPO_ERROR',
            details: item.details
          }
        });

        const token = tokens[index]?.substring(0, 30) + '...';
        this.logger.error(`❌ Failed to send to token ${token}: ${item.message}`);
      }
    });

    this.logger.log(`📊 Expo push result: ${successCount} success, ${failureCount} failures`);

    return { successCount, failureCount, responses };
  }

  async validateToken(token: string): Promise<boolean> {
    if (!this.isCompatibleToken(token)) {
      return false;
    }

    try {
      const testMessage: ExpoPushMessage = {
        to: token,
        title: 'Test',
        body: 'Token validation',
        data: { test: true },
      };

      const response = await fetch(this.EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([testMessage]),
      });

      if (!response.ok) {
        return false;
      }

      const result: ExpoPushApiResponse = await response.json();
      return result.data[0]?.status === 'ok';

    } catch (error) {
      this.logger.debug(`Token validation failed for ${token.substring(0, 30)}...: ${error.message}`);
      return false;
    }
  }

  isCompatibleToken(token: string): boolean {
    return token.startsWith('ExponentPushToken[') && token.endsWith(']');
  }
}