import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_PLATFORM_KEY } from '../decorators/skip-platform.decorator';

@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Check if route has @SkipPlatform() decorator
    const skipPlatform = this.reflector.getAllAndOverride<boolean>(SKIP_PLATFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipPlatform) {
      return true;
    }

    // Check if route has @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // If neither decorator is present, validate platform parameter
    const platform = request.query.platform as string;

    if (!platform) {
      throw new BadRequestException({
        success: false,
        message: 'El parámetro platform es obligatorio',
        error: 'PLATFORM_REQUIRED'
      });
    }

    // Validate that it's a valid platform
    const validPlatforms = ['client', 'aliados', 'admin'];
    if (!validPlatforms.includes(platform)) {
      throw new BadRequestException({
        success: false,
        message: 'Plataforma no válida.',
        error: 'INVALID_PLATFORM'
      });
    }

    // console.log('platform Ok', platform);
    request.platform = platform;

    return true;
  }
}
