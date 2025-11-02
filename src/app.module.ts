import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from './users/users.module';
import { ServiceCategoriesModule } from './service_categories/service_categories.module';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { ConfigurationScheme } from './config/configuration.scheme';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './auth/passport_strategies/jwt.strategy';
import { LoggerModule } from './common/logger/logger.module';
import { CacheModule } from './cache/cache.module';
import { ServiceRequestModule } from './service_request/service_request.module';
import { VerifiableDocumentsModule } from './verifiable_documents/verifiable_documents.module';
import { IntrabblersModule } from './intrabblers/intrabblers.module';
import { PlatformGuard } from './common/guards/platform.guard';
import { AppGateway } from './app/app.gateway';
import { QuotationsModule } from './quotations/quotations.module';
import { CommonModule } from './common/common.module';
import { ApplicationsModule } from './applications/applications.module';
import { AllyAvailabilityModule } from './ally-availability/ally-availability.module';
import { CommissionSettingsModule } from './commission-settings/commission-settings.module';
import { QueueModule } from './queue/queue.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DeviceTokensModule } from './device-tokens/device-tokens.module';
import { PaymentGatewaysModule } from './payment-gateways/payment-gateways.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      load: [configuration],
      validationSchema: ConfigurationScheme,
      validationOptions: {
        abortEarly: true
      },
      isGlobal: true
    }),
    JwtModule.register({
      global: true
    }),
    LoggerModule,
    CacheModule,
    UsersModule,
    ServiceCategoriesModule,
    AuthModule,
    ServiceRequestModule,
    VerifiableDocumentsModule,
    IntrabblersModule,
    QuotationsModule,
    CommonModule,
    ApplicationsModule,
    AllyAvailabilityModule,
    CommissionSettingsModule,
    QueueModule,
    NotificationsModule,
    DeviceTokensModule,
    PaymentGatewaysModule,
    PaymentsModule
  ],
  controllers: [],
  providers: [
    PrismaService,
    JwtStrategy,
    AppGateway,
    {
      provide: APP_GUARD,
      useClass: PlatformGuard,
    }
  ],
})
export class AppModule {}
