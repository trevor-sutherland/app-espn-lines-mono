/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const port = Number(process.env.PORT) || 3000;
  Logger.log(
    `startup PORT=${process.env.PORT ?? '(unset)'} NODE_ENV=${process.env.NODE_ENV} MONGO_URI=${Boolean(process.env.MONGO_URI)} MONGODB_URI=${Boolean(process.env.MONGODB_URI)} JWT_SECRET=${Boolean(process.env.JWT_SECRET)}`,
    'Bootstrap',
  );

  // Bind 8080 before Nest/Mongo so Cloud Run's TCP startup probe can succeed.
  const server = express();
  let ready = false;
  server.get('/health', (_req, res) => {
    res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'starting' });
  });
  await new Promise<void>((resolve, reject) => {
    const httpServer = server.listen(port, '0.0.0.0', () => {
      Logger.log(`Listening on 0.0.0.0:${port}`, 'Bootstrap');
      resolve();
    });
    httpServer.on('error', reject);
  });

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(server),
    { abortOnError: false },
  );
  const corsOrigins = (process.env.WEB_APP_URL || 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.setGlobalPrefix('api', { exclude: ['health'] });
  await app.init();
  ready = true;
  Logger.log(`Application is running on: http://0.0.0.0:${port}/api`);
}

bootstrap().catch((err) => {
  Logger.error(
    err instanceof Error ? err.stack ?? err.message : String(err),
    'Bootstrap',
  );
  // Stay alive so Cloud Run keeps the open port; check logs for the error above.
});
