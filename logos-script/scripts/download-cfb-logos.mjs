import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import pLimit from 'p-limit';
import sharp from 'sharp';

// Source mapping (SportsDataverse / cfbfastR)
const CSV_URL = 'https://raw.githubusercontent.com/sportsdataverse/cfbfastR-data/main/themes/logos.csv'; // school, abbreviation, logo, logo_dark, etc.
// Doc mention of this CSV: https://cfbfastr.sportsdataverse.org/articles/cfbd_stats.html

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
// UI serves these as /assets/ncaaf/{ABBR}.png (see pick.html + getSportAbbr)
const OUT_DIR = path.resolve(
  process.env.OUT_DIR || path.join(SCRIPT_DIR, '../../ui/public/assets/ncaaf'),
);
const TMP_DIR = path.resolve(
  process.env.TMP_DIR || path.join(SCRIPT_DIR, '../.cache/cfb-logos'),
);
const CONCURRENCY = Number(process.env.CONCURRENCY || 6);
const PNG_SIZE = Number(process.env.PNG_SIZE || 256);
// Comma list, e.g. "SEC,ACC,BIG TEN" (matches CSV's "conference" strings, case-insensitive). Leave empty for ALL.
const CONFERENCES = (process.env.CONFERENCES || getArg('--conferences') || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
// Use dark variant?
const USE_DARK = (process.env.DARK || getArg('--dark') || 'false').toLowerCase() === 'true';

// UI team-abbreviation.ts uses some abbrs that differ from the SportsDataverse CSV
const UI_ALIASES = {
  MIA: 'MIAMI',
  OHST: 'OSU',
  WISC: 'WIS',
  MIZZ: 'MIZ',
  SCAR: 'SC',
  TAMU: 'TA&M',
  VAND: 'VAN',
  CINC: 'CIN',
  FAU: 'FAU-2',
  ARKST: 'ARST',
  LA: 'ULL',
  BOISE: 'BSU',
  JSU: 'JVST',
};

function getArg(flag) {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1];
  return '';
}

function slugify(s) {
  return s.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

async function fetchCsv() {
  const { data } = await axios.get(CSV_URL, { timeout: 20000 });
  return data;
}

function parseCsv(csvText) {
  // Known columns (as of SDV dataset): team_id,school,mascot,abbreviation,...,conference,division,color,alt_color,logo,logo_dark
  const rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
  return rows.map(r => ({
    school: r.school?.trim() || '',
    abbr: r.abbreviation?.trim() || '',
    conference: r.conference?.trim() || '',
    logo: (USE_DARK ? r.logo_dark : r.logo)?.trim() || r.logo?.trim() || '',
  })).filter(x => x.school && x.logo);
}

function filterByConference(items) {
  if (!CONFERENCES.length) return items;
  const want = new Set(CONFERENCES.map(c => c.toLowerCase()));
  return items.filter(i => i.conference && want.has(i.conference.toLowerCase()));
}

function filenameFor(item, seen) {
  const base = item.abbr || slugify(item.school);
  let name = base;
  let k = 2;
  while (seen.has(name)) {
    name = `${base}-${k++}`;
  }
  seen.add(name);
  return `${name}.png`;
}

function guessExt(url, contentType) {
  const lc = (contentType || '').toLowerCase();
  if (lc.includes('svg')) return 'svg';
  if (lc.includes('png')) return 'png';
  if (lc.includes('jpeg') || lc.includes('jpg')) return 'jpg';
  const m = url.toLowerCase().match(/\.(svg|png|jpe?g|webp)(?:[\?#]|$)/);
  return m ? m[1].replace('jpeg', 'jpg') : 'png';
}

async function download(url, tmpPath) {
  const res = await axios.get(url, {
    responseType: 'stream',
    timeout: 25000,
    // allow redirects; fail if 4xx
    maxRedirects: 5,
    validateStatus: s => s < 400,
  });
  await pipeline(res.data, fs.createWriteStream(tmpPath));
  return res.headers['content-type'];
}

async function toPng(inFile, outFile, size = PNG_SIZE) {
  await sharp(inFile)
    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toFile(outFile);
}

async function saveLogo(item, outFile) {
  const extFromUrl = path.extname(new URL(item.logo).pathname || '').replace('.', '') || 'png';
  const tmp = path.join(TMP_DIR, `${slugify(item.school)}.${extFromUrl}`);
  try {
    const ct = await download(item.logo, tmp);
    // If extension guess was wrong (e.g., content-type svg), keep going; sharp handles SVG/PNG/JPG.
    await toPng(tmp, outFile, PNG_SIZE);
  } finally {
    fs.existsSync(tmp) && fs.unlinkSync(tmp);
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const csvText = await fetchCsv();
  let items = parseCsv(csvText);
  items = filterByConference(items);

  // Unique filenames; handle abbr collisions (e.g., USC)
  const seen = new Set();
  const limit = pLimit(CONCURRENCY);

  let ok = 0, fail = 0;

  await Promise.all(items.map(item => limit(async () => {
    const outName = filenameFor(item, seen);
    const outPath = path.join(OUT_DIR, outName);
    try {
      await saveLogo(item, outPath);
      console.log(`✓ ${item.abbr || item.school} → ${outName}`);
      ok++;
    } catch (e) {
      console.error(`✗ ${item.abbr || item.school} failed: ${e.message}`);
      fail++;
    }
  })));

  console.log(`Done. Saved ${ok}, failed ${fail}. Output → ${OUT_DIR}`);

  // Mirror files under the abbrs the Angular UI expects
  let aliased = 0;
  for (const [uiAbbr, sourceAbbr] of Object.entries(UI_ALIASES)) {
    const src = path.join(OUT_DIR, `${sourceAbbr}.png`);
    const dest = path.join(OUT_DIR, `${uiAbbr}.png`);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      aliased++;
      console.log(`↔ alias ${uiAbbr} ← ${sourceAbbr}`);
    } else {
      console.warn(`⚠ alias skipped: missing ${sourceAbbr}.png for ${uiAbbr}`);
    }
  }
  console.log(`Aliases created: ${aliased}/${Object.keys(UI_ALIASES).length}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
