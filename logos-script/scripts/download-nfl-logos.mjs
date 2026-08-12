#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import pLimit from 'p-limit';
import sharp from 'sharp';

const SOURCES = [
  'https://raw.githubusercontent.com/nflverse/nflverse-pbp/master/teams_colors_logos.csv',
  'https://raw.githubusercontent.com/guga31bb/nflfastR-data/master/teams_colors_logos.csv',
];

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
// UI serves these as /assets/nfl/{ABBR}.png (see pick.html + getSportAbbr)
const OUT_DIR = path.resolve(
  process.env.OUT_DIR || path.join(SCRIPT_DIR, '../../ui/public/assets/nfl'),
);
const TMP_DIR = path.resolve(
  process.env.TMP_DIR || path.join(SCRIPT_DIR, '../.cache/nfl-logos'),
);
const CONCURRENCY = 6;
const PNG_SIZE = 256; // final longest side (fit: 'inside')

async function fetchCsv() {
  let lastErr;
  for (const url of SOURCES) {
    try {
      const { data } = await axios.get(url, { timeout: 15000 });
      return data;
    } catch (e) {
      lastErr = e;
      console.warn(`CSV fetch failed from ${url}, trying next…`);
    }
  }
  throw lastErr ?? new Error('Could not fetch teams_colors_logos.csv');
}

function toOriginalWikiUpload(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('upload.wikimedia.org')) return url;
    const parts = u.pathname.split('/').filter(Boolean);
    const thumbIdx = parts.indexOf('thumb');
    if (thumbIdx === -1) return url;
    const base = parts.slice(0, thumbIdx).join('/');              // wikipedia/en
    const hashPath = parts.slice(thumbIdx + 1, thumbIdx + 4).join('/'); // 3/37/File.svg
    return `${u.origin}/${base}/${hashPath}`;
  } catch {
    return url;
  }
}

function guessExt(url, contentType) {
  const lc = (contentType || '').toLowerCase();
  if (lc.includes('svg')) return 'svg';
  if (lc.includes('png')) return 'png';
  if (lc.includes('jpeg') || lc.includes('jpg')) return 'jpg';
  const m = url.toLowerCase().match(/\.(svg|png|jpe?g|webp)(?:[\?#]|$)/);
  return m ? m[1].replace('jpeg', 'jpg') : 'png';
}

async function downloadToTemp(teamAbbr, url) {
  const finalUrl = toOriginalWikiUpload(url);
  const res = await axios.get(finalUrl, {
    responseType: 'stream',
    timeout: 20000,
    headers: {
      'User-Agent': 'espn-lines-logo-downloader/1.0',
      Accept: 'image/*,*/*',
    },
    validateStatus: s => s < 400,
  });
  const ext = guessExt(finalUrl, res.headers['content-type']);
  const tmpPath = path.join(TMP_DIR, `${teamAbbr}.${ext}`);
  await pipeline(res.data, fs.createWriteStream(tmpPath));
  return tmpPath;
}

async function toPng(inFile, outFile, size = PNG_SIZE) {
  // Convert to PNG at a max dimension = size, preserving aspect & transparency
  await sharp(inFile)
    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toFile(outFile);
}

async function saveLogo(teamAbbr, url) {
  // 1) Try original upload first
  try {
    const tmp = await downloadToTemp(teamAbbr, url);
    const out = path.join(OUT_DIR, `${teamAbbr}.png`);
    await toPng(tmp, out);
    fs.unlink(tmp, () => {});
    return out;
  } catch (e) {
    // 2) Fallback: try the URL as-is (e.g., thumbnail or alternate host)
    try {
      const res = await axios.get(url, {
        responseType: 'stream',
        timeout: 20000,
        headers: {
          'User-Agent': 'espn-lines-logo-downloader/1.0',
          Accept: 'image/*,*/*',
        },
        validateStatus: s => s < 400,
      });
      const ext = guessExt(url, res.headers['content-type']);
      const tmp = path.join(TMP_DIR, `${teamAbbr}.${ext}`);
      await pipeline(res.data, fs.createWriteStream(tmp));
      const out = path.join(OUT_DIR, `${teamAbbr}.png`);
      await toPng(tmp, out);
      fs.unlink(tmp, () => {});
      return out;
    } catch (e2) {
      throw e2;
    }
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const csvText = await fetchCsv();
  const rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });

  const items = rows
    .filter(r => r.team_abbr && (r.team_logo_espn || r.team_logo_wikipedia))
    .map(r => ({
      abbr: r.team_abbr,
      name: r.team_name,
      // Prefer ESPN CDN — Wikimedia often 403s automated downloads
      url: (r.team_logo_espn || r.team_logo_wikipedia).trim(),
    }));

  const limit = pLimit(CONCURRENCY);
  let ok = 0, fail = 0;

  await Promise.all(items.map(item => limit(async () => {
    try {
      const out = await saveLogo(item.abbr, item.url);
      console.log(`✓ ${item.abbr} → ${path.basename(out)}`);
      ok++;
    } catch (e) {
      console.error(`✗ ${item.abbr} failed: ${e.message}`);
      fail++;
    }
  })));

  console.log(`Done. Saved ${ok}, failed ${fail}. Output → ${OUT_DIR}`);
  // Optional: clean tmp dir if empty
  try { fs.rmdirSync(TMP_DIR); } catch {}
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
