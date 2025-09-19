import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseAdminService {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private firebaseApp: admin.app.App;

  constructor(private configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');

    if (!admin.apps.length) {
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey: privateKey?.replace(/\\n/g, '\n'),
          clientEmail,
        }),
      });
    } else {
      this.firebaseApp = admin.app();
    }
  }

  async sendPushNotification(tokens: string | string[], payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
    imageUrl?: string;
  }) {
    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: Array.isArray(tokens) ? tokens : [tokens],
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      console.log(`Push notification message:`, message);
      const response = await admin.messaging().sendEachForMulticast(message);

      this.logger.log(`Push notification sent: ${response.successCount} success, ${response.failureCount} failures`);

      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            this.logger.error(`Failed to send to token ${idx}: ${resp.error?.message}`);
          }
        });
      }

      return response;
    } catch (error) {
      this.logger.error('Error sending push notification:', error);
      throw error;
    }
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      await admin.messaging().send({
        token,
        data: { test: 'validation' },
      }, true); // dry run
      return true;
    } catch (error) {
      this.logger.warn(`Invalid FCM token: ${token}`);
      return false;
    }
  }
}
