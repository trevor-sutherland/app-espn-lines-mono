/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigins = (process.env.WEB_APP_URL || 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix, { exclude: ['health'] });
  // Cloud Run injects PORT (default 8080). Local/compose default to 3000.
  const port = Number(process.env.PORT) || 3000;
  // Bind all interfaces so Docker / Cloud Run can reach the API
  await app.listen(port, '0.0.0.0');
  Logger.log(
    `Application is running on: http://0.0.0.0:${port}/${globalPrefix}`
  );
}

bootstrap().catch((err) => {
  Logger.error(
    err instanceof Error ? err.stack ?? err.message : String(err),
    'Bootstrap',
  );
  process.exit(1);
});
