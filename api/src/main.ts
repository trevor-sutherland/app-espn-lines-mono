/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import dns from 'node:dns';
import express, { NextFunction, Request, Response } from 'express';
import { AppModule } from './app/app.module';

// Cloud Run + Atlas SRV often resolves IPv6 first and never connects.
dns.setDefaultResultOrder('ipv4first');

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }
  const configured = (process.env.WEB_APP_URL || 'http://localhost:4200')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return (
    configured.includes(origin) ||
    origin.endsWith('.azurestaticapps.net') ||
    /^http:\/\/localhost:\d+$/.test(origin)
  );
}

function applyCors(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization',
    );
    res.header(
      'Access-Control-Allow-Methods',
      'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    );
    res.header('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

async function bootstrap() {
  const port = Number(process.env.PORT) || 3000;
  Logger.log(
    `startup PORT=${process.env.PORT ?? '(unset)'} NODE_ENV=${process.env.NODE_ENV} MONGO_URI=${Boolean(process.env.MONGO_URI)} MONGODB_URI=${Boolean(process.env.MONGODB_URI)} JWT_SECRET=${Boolean(process.env.JWT_SECRET)}`,
    'Bootstrap',
  );

  // Bind 8080 before Nest/Mongo so Cloud Run's TCP startup probe can succeed.
  const server = express();
  server.use(applyCors);
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
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowed = isAllowedOrigin(origin);
      callback(allowed ? null : new Error(`CORS blocked: ${origin}`), allowed);
    },
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
