/**
 * Import NCAA LOTW sheet (docs/LOTW Sheet.xlsx) into Mongo for season 2025.
 *
 * Usage (from repo root, Mongo running):
 *   npm run import:lotw-ncaa
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import mongoose from 'mongoose';
import * as argon2 from 'argon2';
import * as XLSX from 'xlsx';

const SEASON = 2025;
const IMPORT_PASSWORD = 'password123';
const XLSX_PATH = path.resolve(__dirname, '../docs/LOTW Sheet.xlsx');
const MAX_WEEKS = 15;

type MappedOutcome = {
  status: 'won' | 'lost';
  supercharged: boolean;
} | null;

function loadEnv(): void {
  const envPath = path.resolve(__dirname, '../.env');
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

function slug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'player';
}

function parseLine(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, '');
  const m = s.match(/^[ou]?(-?\d+(?:\.\d+)?)$/);
  if (m) return Number(m[1]);
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function mapResult(raw: unknown): MappedOutcome {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (n === 1) return { status: 'won', supercharged: false };
  if (n === 0) return { status: 'lost', supercharged: false };
  if (n === 2) return { status: 'won', supercharged: true };
  if (n === -1) return { status: 'lost', supercharged: true };
  return null;
}

function weekLockedAt(week: number): Date {
  // Approx: 2025 season week 1 starts around Labor Day week
  const base = new Date(Date.UTC(2025, 8, 1)); // Sep 1 2025
  base.setUTCDate(base.getUTCDate() + (week - 1) * 7);
  return base;
}

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
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
    status: {
      type: String,
      enum: ['pending', 'won', 'lost', 'void'],
      default: 'pending',
    },
    supercharged: { type: Boolean, default: false },
  },
  { timestamps: true },
);
PickSchema.index({ userId: 1, season: 1, week: 1 }, { unique: true });

async function main(): Promise<void> {
  loadEnv();
  const mongoUri =
    process.env.MONGO_URI || 'mongodb://localhost:27017/espn-lines';

  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`Workbook not found: ${XLSX_PATH}`);
  }

  const wb = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets['NCAA'];
  if (!sheet) throw new Error('Sheet "NCAA" not found');

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  await mongoose.connect(mongoUri);
  const User = mongoose.model('User', UserSchema);
  const Pick = mongoose.model('Pick', PickSchema);

  const passwordHash = await argon2.hash(IMPORT_PASSWORD);
  let usersCreated = 0;
  let usersReused = 0;
  let picksUpserted = 0;
  let picksSkipped = 0;

  const userCache = new Map<string, mongoose.Types.ObjectId>();

  async function resolveUser(displayName: string): Promise<mongoose.Types.ObjectId> {
    const key = displayName.toLowerCase();
    const cached = userCache.get(key);
    if (cached) return cached;

    const existing = await User.findOne({
      displayName: new RegExp(`^${displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    }).exec();

    if (existing) {
      usersReused += 1;
      userCache.set(key, existing._id as mongoose.Types.ObjectId);
      return existing._id as mongoose.Types.ObjectId;
    }

    const email = `${slug(displayName)}@lotw.local`;
    try {
      const created = await User.create({
        email,
        passwordHash,
        displayName,
        role: 'user',
        approved: true,
        active: true,
      });
      usersCreated += 1;
      userCache.set(key, created._id as mongoose.Types.ObjectId);
      return created._id as mongoose.Types.ObjectId;
    } catch (err: unknown) {
      // Email collision: reuse by email
      if (
        typeof err === 'object' &&
        err &&
        'code' in err &&
        (err as { code?: number }).code === 11000
      ) {
        const byEmail = await User.findOne({ email }).exec();
        if (byEmail) {
          usersReused += 1;
          userCache.set(key, byEmail._id as mongoose.Types.ObjectId);
          return byEmail._id as mongoose.Types.ObjectId;
        }
      }
      throw err;
    }
  }

  // Row 0 = week headers, row 1 = column labels, data from row 2
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const playerRaw = row[0];
    if (playerRaw == null) continue;
    const displayName = String(playerRaw).trim();
    if (
      !displayName ||
      displayName === 'Week Total' ||
      displayName.startsWith('Payout') ||
      /^\d+$/.test(displayName)
    ) {
      continue;
    }

    const userId = await resolveUser(displayName);

    for (let week = 1; week <= MAX_WEEKS; week++) {
      const col = 1 + (week - 1) * 4; // Pick, Line, Result, Margin
      const pickTeam = row[col];
      const lineRaw = row[col + 1];
      const resultRaw = row[col + 2];

      const outcome = mapResult(resultRaw);
      if (!outcome) {
        picksSkipped += 1;
        continue;
      }
      if (pickTeam == null || String(pickTeam).trim() === '') {
        picksSkipped += 1;
        continue;
      }

      const team = String(pickTeam).trim();
      const line = parseLine(lineRaw);
      const eventId = `lotw-ncaaf-${SEASON}-w${week}-${slug(team)}-${slug(displayName)}`;

      await Pick.findOneAndUpdate(
        { userId, season: SEASON, week },
        {
          $set: {
            userId,
            season: SEASON,
            week,
            eventId,
            team,
            line,
            lockedAt: weekLockedAt(week),
            status: outcome.status,
            supercharged: outcome.supercharged,
          },
        },
        { upsert: true, new: true },
      );
      picksUpserted += 1;
    }
  }

  console.log('LOTW NCAA import complete');
  console.log(`  season: ${SEASON}`);
  console.log(`  users created: ${usersCreated}`);
  console.log(`  users reused: ${usersReused}`);
  console.log(`  picks upserted: ${picksUpserted}`);
  console.log(`  cells skipped: ${picksSkipped}`);
  console.log(`  login password for new users: ${IMPORT_PASSWORD}`);
  console.log(`  emails: {slug}@lotw.local`);

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
