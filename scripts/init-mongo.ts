/**
 * Start local Mongo if needed, then seed admin / indexes / current-week odds.
 *
 * Usage (from repo root):
 *   npm run mongo:init
 *   npm run mongo:init -- --skip-odds
 *   npm run mongo:init -- --lotw
 *   npm run mongo:init -- --uri 'mongodb+srv://user:pass@cluster.mongodb.net/espn-lines'
 *
 * URI resolution: --uri, then MONGODB_URI (Atlas), then MONGO_URI, then localhost.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import mongoose from 'mongoose';
import * as argon2 from 'argon2';
import axios from 'axios';
import { getCurrentSeasonAndWeek } from '../api/src/lib/utils/seasson-week.util';
import type {
  OddsApiEvent,
  NormalizedOddsRow,
} from '../api/src/lib/odds/models/odds.model';

const ROOT = path.resolve(__dirname, '..');
const SPORT_KEYS = [
  'americanfootball_nfl',
  'americanfootball_ncaaf',
  'basketball_nba',
  'basketball_ncaab',
] as const;

type Args = {
  uri?: string;
  skipOdds: boolean;
  skipAdmin: boolean;
  noDocker: boolean;
  lotw: boolean;
};

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    approved: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const PickSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    season: { type: Number, required: true },
    week: { type: Number, required: true },
    eventId: { type: String, required: true },
    team: { type: String, required: true },
    line: { type: Number, default: null },
    lockedAt: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'won', 'lost', 'void'], default: 'pending' },
    supercharged: { type: Boolean, default: false },
  },
  { timestamps: true },
);
PickSchema.index({ userId: 1, season: 1, week: 1 }, { unique: true });

const OddsLatestSchema = new mongoose.Schema(
  {
    sport: { type: String, required: true },
    eventId: { type: String, required: true },
    commenceTime: { type: String, required: true },
    bookmakerKey: { type: String, required: true },
    bookmakerTitle: { type: String, required: true },
    market: { type: String, required: true },
    selection: { type: String, required: true },
    team: { type: String },
    line: { type: Number, default: null },
    price: { type: Number, required: true },
    lastUpdate: { type: String, required: true },
  },
  { timestamps: true },
);
OddsLatestSchema.index(
  { sport: 1, eventId: 1, bookmakerKey: 1, market: 1, selection: 1, team: 1 },
  { unique: true },
);

const SeasonPotSchema = new mongoose.Schema(
  {
    season: { type: Number, required: true, unique: true },
    potAmount: { type: Number, required: true, default: 0, min: 0 },
    adminFeePercent: { type: Number, required: true, default: 0, min: 0, max: 100 },
    payments: { type: Array, default: [] },
  },
  { timestamps: true },
);

const GameResultSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    sportKey: { type: String, required: true },
    commenceTime: { type: Date, required: true },
    homeTeam: { type: String, required: true },
    awayTeam: { type: String, required: true },
    homeScore: { type: Number, required: true },
    awayScore: { type: Number, required: true },
    completed: { type: Boolean, required: true, default: true },
    lastUpdate: { type: Date, default: null },
  },
  { timestamps: true },
);

function loadEnv(): void {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    skipOdds: false,
    skipAdmin: false,
    noDocker: false,
    lotw: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--skip-odds') args.skipOdds = true;
    else if (a === '--skip-admin') args.skipAdmin = true;
    else if (a === '--no-docker') args.noDocker = true;
    else if (a === '--lotw') args.lotw = true;
    else if (a === '--uri') args.uri = argv[++i];
    else if (a.startsWith('--uri=')) args.uri = a.slice('--uri='.length);
  }
  return args;
}

function redact(uri: string): string {
  return uri.replace(/:([^:@/]+)@/, ':***@');
}

function withDbName(uri: string, db = 'espn-lines'): string {
  const u = new URL(uri);
  if (!u.pathname || u.pathname === '/') {
    u.pathname = `/${db}`;
  }
  return u.toString();
}

function resolveMongoUri(cliUri?: string): string {
  const raw =
    cliUri ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    'mongodb://localhost:27017/espn-lines';
  return withDbName(raw);
}

function isLocalMongo(uri: string): boolean {
  try {
    const host = new URL(uri).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return /localhost|127\.0\.0\.1/.test(uri);
  }
}

function startLocalMongo(): void {
  console.log('Starting local Mongo via docker compose...');
  const result = spawnSync('docker', ['compose', 'up', '-d', 'mongodb'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(
      'Failed to start mongodb. Is Docker running? Or pass --no-docker / --uri.',
    );
  }
}

async function waitForMongo(uri: string, attempts = 30): Promise<void> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
      return;
    } catch (err) {
      last = err;
      await mongoose.disconnect().catch(() => undefined);
      process.stdout.write(`Waiting for Mongo (${i}/${attempts})...\n`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw last instanceof Error ? last : new Error('Mongo did not become ready');
}

function mapHomeAway(name: string, home: string): 'home' | 'away' {
  const n = name.toLowerCase();
  return n === home.toLowerCase() || home.toLowerCase().includes(n)
    ? 'home'
    : 'away';
}

function mapOverUnder(name: string): 'over' | 'under' {
  return name.toLowerCase().startsWith('o') ? 'over' : 'under';
}

function mapH2H(name: string, home: string, away: string): 'home' | 'away' | 'draw' {
  const n = name.toLowerCase();
  if (n === 'draw') return 'draw';
  if (n === home.toLowerCase()) return 'home';
  if (n === away.toLowerCase()) return 'away';
  return 'draw';
}

function normalizeEvents(events: OddsApiEvent[]): NormalizedOddsRow[] {
  const rows: NormalizedOddsRow[] = [];
  for (const ev of events) {
    for (const bm of ev.bookmakers ?? []) {
      for (const mkt of bm.markets ?? []) {
        for (const oc of mkt.outcomes ?? []) {
          const base = {
            sport: ev.sport_key,
            eventId: ev.id,
            commenceTime: ev.commence_time,
            bookmakerKey: bm.key,
            bookmakerTitle: bm.title,
            team: oc.name,
            price: oc.price,
            lastUpdate: bm.last_update,
          };
          if (mkt.key === 'spreads') {
            rows.push({
              ...base,
              market: 'spreads',
              selection: mapHomeAway(oc.name, ev.home_team),
              line: oc.point ?? null,
            });
          } else if (mkt.key === 'totals') {
            rows.push({
              ...base,
              market: 'totals',
              selection: mapOverUnder(oc.name),
              line: oc.point ?? null,
            });
          } else if (mkt.key === 'h2h') {
            rows.push({
              ...base,
              market: 'h2h',
              selection: mapH2H(oc.name, ev.home_team, ev.away_team),
              line: null,
            });
          }
        }
      }
    }
  }
  return rows;
}

async function seedAdmin(
  User: mongoose.Model<mongoose.Document>,
): Promise<string> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  }
  const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || 'Admin';
  const passwordHash = await argon2.hash(password);
  await User.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        passwordHash,
        displayName,
        role: 'admin',
        approved: true,
        active: true,
      },
    },
    { upsert: true, new: true },
  );
  return email;
}

async function seedOdds(
  OddsLatest: mongoose.Model<mongoose.Document>,
): Promise<Record<string, number>> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    console.warn('ODDS_API_KEY is not set; skipping odds populate.');
    return {};
  }

  const markets = process.env.ODDS_API_MARKETS || 'spreads,totals';
  const bookmakers = process.env.ODDS_API_BOOKMAKERS || 'draftkings';
  const oddsFormat = process.env.ODDS_API_FORMAT || 'american';
  const counts: Record<string, number> = {};

  for (const sportKey of SPORT_KEYS) {
    const { data } = await axios.get<OddsApiEvent[]>(
      `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(sportKey)}/odds`,
      {
        params: { apiKey, markets, bookmakers, oddsFormat, dateFormat: 'iso' },
        timeout: 15_000,
      },
    );
    const rows = normalizeEvents(data ?? []);
    if (!rows.length) {
      counts[sportKey] = 0;
      continue;
    }
    const ops = rows.map((r) => ({
      updateOne: {
        filter: {
          sport: r.sport,
          eventId: r.eventId,
          bookmakerKey: r.bookmakerKey,
          market: r.market,
          selection: r.selection,
          team: r.team,
        },
        update: { $set: r },
        upsert: true,
      },
    }));
    const bulk = await OddsLatest.bulkWrite(ops, { ordered: false });
    counts[sportKey] = (bulk.upsertedCount ?? 0) + (bulk.modifiedCount ?? 0);
    console.log(`  ${sportKey}: ${rows.length} quotes (${counts[sportKey]} written)`);
  }
  return counts;
}

async function seedSeasonPot(
  SeasonPot: mongoose.Model<mongoose.Document>,
): Promise<number> {
  const { season } = getCurrentSeasonAndWeek();
  await SeasonPot.findOneAndUpdate(
    { season },
    { $setOnInsert: { season, potAmount: 0, adminFeePercent: 0, payments: [] } },
    { upsert: true },
  );
  return season;
}

function importLotw(): void {
  const xlsx = path.join(ROOT, 'docs', 'LOTW Sheet.xlsx');
  if (!fs.existsSync(xlsx)) {
    console.warn(`LOTW workbook not found at ${xlsx}; skipping.`);
    return;
  }
  console.log('Importing NCAA LOTW history...');
  const result = spawnSync('npx', ['tsx', 'scripts/import-lotw-ncaa.ts'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error('LOTW import failed');
  }
}

async function main(): Promise<void> {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const mongoUri = resolveMongoUri(args.uri);
  process.env.MONGO_URI = mongoUri;

  console.log(`Mongo target: ${redact(mongoUri)}`);

  if (isLocalMongo(mongoUri) && !args.noDocker) {
    startLocalMongo();
  }

  await waitForMongo(mongoUri);
  console.log('Connected.');

  const User = mongoose.model('User', UserSchema);
  const Pick = mongoose.model('Pick', PickSchema);
  const OddsLatest = mongoose.model('OddsLatest', OddsLatestSchema);
  const SeasonPot = mongoose.model('SeasonPot', SeasonPotSchema);
  const GameResult = mongoose.model('GameResult', GameResultSchema);

  await Promise.all([
    User.syncIndexes(),
    Pick.syncIndexes(),
    OddsLatest.syncIndexes(),
    SeasonPot.syncIndexes(),
    GameResult.syncIndexes(),
  ]);
  console.log('Indexes ensured.');

  if (!args.skipAdmin) {
    const email = await seedAdmin(User);
    console.log(`Admin seeded: ${email}`);
  }

  const potSeason = await seedSeasonPot(SeasonPot);
  console.log(`Season pot ready for ${potSeason}.`);

  if (!args.skipOdds) {
    console.log('Fetching current odds...');
    await seedOdds(OddsLatest);
  }

  if (args.lotw) {
    importLotw();
  }

  const [users, picks, odds, pots, results] = await Promise.all([
    User.countDocuments(),
    Pick.countDocuments(),
    OddsLatest.countDocuments(),
    SeasonPot.countDocuments(),
    GameResult.countDocuments(),
  ]);
  console.log('Mongo init complete');
  console.log(`  users: ${users}`);
  console.log(`  picks: ${picks}`);
  console.log(`  odds: ${odds}`);
  console.log(`  pots: ${pots}`);
  console.log(`  results: ${results}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
