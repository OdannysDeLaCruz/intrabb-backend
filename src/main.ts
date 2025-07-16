import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Use Winston logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true
  });

  // Global Middlewares
  // app.use(morgan('dev'));

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

  await app.listen(port, () => {
    console.log(`Server running on http://locahost:${port}`);
  });
}
bootstrap();
