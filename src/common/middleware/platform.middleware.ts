import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Reflector } from '@nestjs/core';

export interface RequestWithPlatform extends Request {
  platform?: string;
  user?: {
    id: string;
  };
}

@Injectable()
export class PlatformMiddleware implements NestMiddleware {
  constructor(private reflector: Reflector) {}

  use(req: RequestWithPlatform, res: Response, next: NextFunction) {
    // Check if the route has @SkipPlatform() decorator
    if (req.route && req.route.handler) {
      const skipPlatform = this.reflector.get<boolean>('skipPlatform', req.route.handler);
      if (skipPlatform) {
        return next();
      }
    }

    // Skip platform validation for public routes
    const shouldSkipPlatform =
      req.baseUrl.includes('/webhooks/') ||
      req.baseUrl.includes('/service-categories/parents');

    if (shouldSkipPlatform) {
      return next();
    }

    const platform = req.query.platform as string;
    if (!platform) {
      throw new BadRequestException({
        success: false,
        message: 'El parámetro platform es obligatorio',
        error: 'PLATFORM_REQUIRED'
      });
    }

    // Validar que sea una plataforma válida
    const validPlatforms = ['client', 'aliados', 'admin'];
    if (!validPlatforms.includes(platform)) {
      throw new BadRequestException({
        success: false,
        message: 'Plataforma no válida.',
        error: 'INVALID_PLATFORM'
      });
    }

    console.log('platform Ok', platform);
    req.platform = platform;
    next();
  }
}