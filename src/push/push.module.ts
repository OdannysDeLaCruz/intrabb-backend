import { Module } from '@nestjs/common';
import { ExpoPushService } from './services/expo-push.service';

@Module({
  providers: [
    {
      provide: 'IPushService', // Token de inyección
      useClass: ExpoPushService, // Implementación actual
    },
  ],
  exports: ['IPushService'],
})
export class PushModule {}