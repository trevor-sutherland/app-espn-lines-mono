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
import { connectAndPingMongo } from './lib/mongo-uri';

// Cloud Run + Atlas SRV often resolves IPv6 first and never connects.
// Some Windows DNS paths refuse Node SRV lookups (querySrv ECONNREFUSED).
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function bootstrap() {
  const port = Number(process.env.PORT) || 3000;
  Logger.log(
    `startup PORT=${process.env.PORT ?? '(unset)'} NODE_ENV=${process.env.NODE_ENV} MONGO_URI=${Boolean(process.env.MONGO_URI)} MONGODB_URI=${Boolean(process.env.MONGODB_URI)} JWT_SECRET=${Boolean(process.env.JWT_SECRET)}`,
    'Bootstrap',
  );

  let ready = false;
  let mongo = {
    connected: false,
    attempts: 0,
    error: null as string | null,
    host: null as string | null,
    ms: null as number | null,
  };

  // Bind 8080 first so Cloud Run's TCP probe does not kill the revision
  // while we actually connect to Mongo.
  const server = express();
  server.use(applyCors);
  server.get('/health', (_req, res) => {
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'starting',
      mongo,
    });
  });
  server.use('/api', (_req, res, next) => {
    if (ready) {
      next();
      return;
    }
    res.status(503).json({
      status: 'starting',
      message: 'API is not ready until MongoDB connects.',
      mongo,
    });
  });
  await new Promise<void>((resolve, reject) => {
    const httpServer = server.listen(port, '0.0.0.0', () => {
      Logger.log(`Listening on 0.0.0.0:${port}`, 'Bootstrap');
      resolve();
    });
    httpServer.on('error', reject);
  });

  while (!mongo.connected) {
    mongo.attempts += 1;
    try {
      const result = await connectAndPingMongo();
      mongo = {
        connected: true,
        attempts: mongo.attempts,
        error: null,
        host: result.host,
        ms: result.ms,
      };
    } catch (err) {
      mongo.error = err instanceof Error ? err.message : String(err);
      Logger.error(
        `Mongo attempt ${mongo.attempts} failed: ${mongo.error}`,
        'Mongo',
      );
      await delay(2000);
    }
  }

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
});
