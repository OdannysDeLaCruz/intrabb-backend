import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    console.log('🔒 [JWT-GUARD] Processing request:', request.method, request.url);
    
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    
    console.log('🔒 [JWT-GUARD] isPublic:', isPublic, 'for route:', request.url);
    
    if (isPublic) {
      console.log('🔒 [JWT-GUARD] Route is public, allowing access');
      return true;
    }

    console.log('🔒 [JWT-GUARD] Route is protected, checking JWT');
    return super.canActivate(context);
  }
}
