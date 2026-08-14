import { Logger } from '@nestjs/common';

const DEFAULT_DB = 'espn-lines';
const LOCAL_HOST = /localhost|127\.0\.0\.1/i;

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

  const uri = ensureDatabase(chosen);
  Logger.log(`MongoDB connecting to ${mongoHostForLog(uri)}`, 'Mongo');
  return uri;
}
