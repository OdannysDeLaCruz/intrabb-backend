import { Module } from '@nestjs/common';
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
    UsersModule,
    ServiceCategoriesModule,
    AuthModule
  ],
  controllers: [],
  providers: [
    PrismaService,
    JwtStrategy
  ],
})
export class AppModule {}
