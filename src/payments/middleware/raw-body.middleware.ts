import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para capturar el body RAW antes de que NestJS lo parsee
 * Necesario para validar la firma de webhooks
 */
@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Solo capturar raw body para webhooks
    if (req.path.includes('/webhooks/')) {
      let rawBody = '';

      req.on('data', (chunk) => {
        rawBody += chunk.toString('utf-8');
      });

      req.on('end', () => {
        (req as any).rawBody = Buffer.from(rawBody);
        next();
      });
    } else {
      next();
    }
  }
}
