import { Logger } from '@nestjs/common';
import mongoose from 'mongoose';

const DEFAULT_DB = 'espn-lines';
const LOCAL_HOST = /localhost|127\.0\.0\.1/i;

export const mongoConnectOptions = {
  family: 4,
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
};

function stripQuotes(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isLocalMongo(uri: string): boolean {
  return LOCAL_HOST.test(uri);
}

function ensureDatabase(uri: string): string {
  try {
    const parsed = new URL(uri);
    if (!parsed.pathname || parsed.pathname === '/') {
      parsed.pathname = `/${DEFAULT_DB}`;
    }
    return parsed.toString();
  } catch {
    return uri;
  }
}

export function mongoHostForLog(uri: string): string {
  try {
    const parsed = new URL(uri);
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
  } catch {
    return '(unparseable Mongo URI)';
  }
}

/**
 * Cloud Run has no local Mongo. Prefer a remote URI (Atlas `MONGODB_URI`)
 * over `MONGO_URI=mongodb://localhost...` copied from the local .env.
 */
export function resolveMongoUri(): string {
  const candidates = [process.env.MONGO_URI, process.env.MONGODB_URI]
    .map(stripQuotes)
    .filter((uri): uri is string => Boolean(uri));
  const production = process.env.NODE_ENV === 'production';
  const chosen = production
    ? candidates.find((uri) => !isLocalMongo(uri))
    : candidates[0];

  if (!chosen) {
    if (production) {
      throw new Error(
        'Set MONGO_URI or MONGODB_URI to your Atlas connection string on the Cloud Run service. The local .env file is not copied into the image. Do not use mongodb://localhost — Cloud Run cannot reach it.',
      );
    }
    return `mongodb://localhost:27017/${DEFAULT_DB}`;
  }

  return ensureDatabase(chosen);
}

/** Open a connection and ping. Throws on failure so callers can log the real error. */
export async function connectAndPingMongo(): Promise<{ host: string; ms: number }> {
  const uri = resolveMongoUri();
  const host = mongoHostForLog(uri);
  const started = Date.now();
  Logger.log(
    `Connecting to ${host} (IPv4, ${mongoConnectOptions.serverSelectionTimeoutMS}ms timeout)`,
    'Mongo',
  );
  await mongoose.connect(uri, mongoConnectOptions);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Mongo connected but connection.db is missing');
  }
  await db.admin().command({ ping: 1 });
  const ms = Date.now() - started;
  Logger.log(`Connected and ping ok in ${ms}ms (${host})`, 'Mongo');
  return { host, ms };
}
