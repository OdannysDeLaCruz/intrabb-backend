import { Injectable, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';

@Injectable()
export class WebhookRawBodyMiddleware implements NestMiddleware {
  use(req: any, res: Response, next: NextFunction) {
    // console.log("RES", res);
    // Only apply to webhook endpoints
    if (req.originalUrl && req.originalUrl.includes('/webhooks/didit')) {
      console.log('Capturing raw body for webhook endpoint');
      
      let rawBody = '';
      req.setEncoding('utf8');
      
      req.on('data', (chunk: string) => {
        console.log('Chunk received:', chunk.substring(0, 100) + '...');
        rawBody += chunk;
      });
      
      req.on('end', () => {
        req.rawBody = rawBody;
        console.log('Raw body captured:', rawBody.substring(0, 100) + '...');
        
        // Parse JSON for NestJS
        try {
          req.body = JSON.parse(rawBody);
        } catch (e) {
          console.error('Error parsing JSON for webhook:', e);
        }
        
        next();
      });
    } else {
      // For all other routes, proceed normally
      next();
    }
  }
}