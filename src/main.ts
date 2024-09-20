import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { validateEnvironmentVars } from './config/configuration';

async function bootstrap() {
  validateEnvironmentVars();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // TODO: read from config env
  app.enableCors({
    origin: [
      'https://35.196.166.199.sslip.io',
      'https://zenithcalendar.com',
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    methods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    credentials: true,
  });
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(3001);
  Logger.log(`⚡️[server]: Running success on port 3001`);
}
bootstrap();
