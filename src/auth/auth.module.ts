import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtStrategy } from './passport_strategies/jwt.strategy';
import { CommonModule } from '../common/common.module';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { SupabaseAuthService } from './supabase-auth.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    CommonModule],
  providers: [
    AuthService,
    PrismaService,
    JwtStrategy,
    SupabaseAuthService,
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    }
  ],
  exports: [PassportModule, SupabaseAuthService],
  controllers: [AuthController],
})
export class AuthModule {}
