import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { SupabaseAuthService } from '../supabase-auth.service';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { User } from '@prisma/client';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private supabaseAuthService: SupabaseAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
// console.log('isPublic sb', isPublic);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    // console.log('SupabaseAuthGuard request', request.headers);
    const user = await this.supabaseAuthService.getUser(request, response);
    
    if (!user) {
      throw new UnauthorizedException();
    }
    // console.log('USER SB', user);

    // Attach user to request for use in controllers
    request.user = user as { id: string };
    return true;
  }
}