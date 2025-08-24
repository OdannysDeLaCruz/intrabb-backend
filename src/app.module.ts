import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
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
import { PlatformMiddleware } from './common/middleware/platform.middleware';
import { WebhookRawBodyMiddleware } from './common/middleware/webhook-raw-body.middleware';
import { AppGateway } from './app/app.gateway';
import { QuotationsModule } from './quotations/quotations.module';

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
    QuotationsModule
  ],
  controllers: [],
  providers: [
    PrismaService,
    JwtStrategy,
    AppGateway
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply webhook middleware FIRST (before body parsing)
    // consumer
    //   .apply(WebhookRawBodyMiddleware)
    //   .forRoutes('*');
    
    consumer
      .apply(PlatformMiddleware)
      .forRoutes('*'); // Aplicar a todas las rutas
  }
}
