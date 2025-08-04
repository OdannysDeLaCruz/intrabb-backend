import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
// import { json } from 'express';
import express, { raw } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false
  });

  // const jsonMiddleware = express.json();

  // app.use((req, res, next) => {
  //   console.log('Request URL:', req.path, req.path.includes('/webhooks/didit'));
  //   if (req.path.includes('/webhooks/didit')) {
  //     next(); // Salta el parser de JSON para la ruta del webhook
  //   } else {
  //     express.json()(req, res, next); // Usa el parser de JSON para el resto
  //   }
  // });

  // app.use('/api/v1/verifiable_documents/notifications/webhooks/didit', raw({ type: '*/*' }));
  app.use(
  express.json({
    verify: (req: any, res, buf, encoding) => {
      if (buf && buf.length) {
        // Store the raw body in the request object
        req.rawBody = buf.toString((encoding as BufferEncoding) || "utf8");
      }
    },
  })
);
  app.use(express.json());
  // Use Winston logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.enableCors({
    origin: '*',
    credentials: true
  });

  // Global Middlewares
  app.use(morgan('dev'));

  app.use(cookieParser());

  app.enableVersioning({
    defaultVersion: '1',
    type: VersioningType.URI
  });

  const apiPath = 'api';
  app.setGlobalPrefix(apiPath);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  // const configService = app.get(ConfigService);
  const port = 3002;

  // console.log('✅ NODE_ENV:', configService.get('NODE_ENV'));
  // console.log('✅ JWT_SECRET:', configService.get('JWT_SECRET'));
  // console.log('✅ JWT_EXPIRES_IN:', configService.get('JWT_EXPIRES_IN'));
  // console.log(
  //   '✅ JWT_REFRESH_EXPIRES_IN:',
  //   configService.get('JWT_REFRESH_EXPIRES_IN')
  // );


  await app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}
bootstrap();
