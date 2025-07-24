import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Use Winston logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.enableCors({
    origin: [
      'http://localhost:3000',     // Frontend web
      'http://localhost',          // App móvil Capacitor
      'http://10.0.2.2:3000',     // Emulador Android
      'capacitor://localhost',     // Protocolo de Capacitor
      'ionic://localhost',         // Protocolo de Ionic
      'http://localhost:8080',     // Posible puerto de desarrollo
      'http://127.0.0.1:3000',     // Localhost alternativo
      'http://localhost:8081',     // Localhost expo
      'http://10.0.2.2:8081',     // Localhost expo
      'http://192.168.1.36:8081', // IP local para dispositivos físicos
      'exp://192.168.1.36:8081',  // Expo URL para dispositivos físicos
    ],
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
    console.log(`Server accessible from emulator on http://10.0.2.2:${port}`);
  });
}
bootstrap();
