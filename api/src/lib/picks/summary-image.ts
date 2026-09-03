import { crc32, deflateSync } from 'zlib';

const SCALE = 3;
const CHAR_W = 5;
const CHAR_H = 7;
const CELL_W = (CHAR_W + 1) * SCALE;
const CELL_H = (CHAR_H + 3) * SCALE;
const PAD = 24;
const WIDTH = 800;

type Rgba = [number, number, number, number];

const BG: Rgba = [18, 18, 20, 255];
const FG: Rgba = [245, 245, 245, 255];
const MUTED: Rgba = [180, 180, 184, 255];
const HEADER_BG: Rgba = [33, 37, 41, 255];
const ROW_ALT: Rgba = [28, 28, 32, 255];
const ACCENT: Rgba = [13, 110, 253, 255];
const LOY_BG: Rgba = [220, 80, 20, 255];
const LOY_FG: Rgba = [255, 240, 220, 255];

/**
 * 5x7 glyphs, one byte per row (low 5 bits). Uppercase scoreboard look.
 * Unknown characters are drawn as a small box.
 */
const FONT: Record<string, number[]> = {
  ' ': [0, 0, 0, 0, 0, 0, 0],
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0e],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x01, 0x01, 0x01, 0x01, 0x11, 0x11, 0x0e],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0e, 0x11, 0x10, 0x0e, 0x01, 0x11, 0x0e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x0e, 0x11, 0x01, 0x06, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ':': [0x00, 0x04, 0x04, 0x00, 0x04, 0x04, 0x00],
  '-': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04],
  '/': [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  ',': [0x00, 0x00, 0x00, 0x00, 0x04, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
  '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  '&': [0x0c, 0x12, 0x0c, 0x15, 0x12, 0x12, 0x0d],
};

export function isSummaryEmail(text: string): boolean {
  return /^LOCKS ONLY\b/m.test(text) && text.includes('PICKS:');
}

export function renderSummaryPng(text: string): Buffer {
  const blocks = layout(text);
  const height = Math.max(PAD * 2 + blocks.length * CELL_H + 8, 120);
  const pixels = Buffer.alloc(WIDTH * height * 4);
  fillRect(pixels, WIDTH, height, 0, 0, WIDTH, height, BG);

  let y = PAD;
  for (const block of blocks) {
    if (block.kind === 'bar') {
      fillRect(pixels, WIDTH, height, 0, y - 6, WIDTH, CELL_H + 4, ACCENT);
      drawText(pixels, WIDTH, height, PAD, y, block.text, FG);
    } else if (block.kind === 'header') {
      fillRect(pixels, WIDTH, height, 0, y - 4, WIDTH, CELL_H + 2, HEADER_BG);
      drawText(pixels, WIDTH, height, PAD, y, 'PLAYER', MUTED);
      drawText(pixels, WIDTH, height, 240, y, 'PICK', MUTED);
    } else if (block.kind === 'row') {
      if (block.alt) {
        fillRect(pixels, WIDTH, height, 0, y - 4, WIDTH, CELL_H + 2, ROW_ALT);
      }
      drawText(pixels, WIDTH, height, PAD, y, block.player, FG);
      drawText(pixels, WIDTH, height, 240, y, block.pick, FG);
      if (block.loy) {
        const loyX = Math.min(
          240 + block.pick.length * CELL_W + 12,
          WIDTH - PAD - 4 * CELL_W,
        );
        fillRect(
          pixels,
          WIDTH,
          height,
          loyX - 6,
          y - 2,
          4 * CELL_W + 4,
          CHAR_H * SCALE + 8,
          LOY_BG,
        );
        drawText(pixels, WIDTH, height, loyX, y, 'LOY', LOY_FG);
      }
    } else {
      drawText(pixels, WIDTH, height, PAD, y, block.text, block.muted ? MUTED : FG);
    }
    y += CELL_H;
  }

  return encodePng(WIDTH, height, pixels);
}

type Block =
  | { kind: 'bar'; text: string }
  | { kind: 'line'; text: string; muted?: boolean }
  | { kind: 'header' }
  | { kind: 'row'; player: string; pick: string; loy: boolean; alt: boolean };

function layout(text: string): Block[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let inPicks = false;
  let alt = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!inPicks) {
      if (line === 'PICKS:') {
        inPicks = true;
        blocks.push({ kind: 'header' });
        continue;
      }
      if (line === 'LOCKS ONLY') {
        blocks.push({ kind: 'bar', text: 'LOCKS ONLY' });
        continue;
      }
      if (!line) {
        blocks.push({ kind: 'line', text: '' });
        continue;
      }
      for (const wrapped of wrapLine(normalize(line), 38)) {
        blocks.push({
          kind: 'line',
          text: wrapped,
          muted: line === 'HIGHLIGHTS:',
        });
      }
      continue;
    }

    if (!line) {
      blocks.push({ kind: 'line', text: '' });
      continue;
    }
    const loy = /\bLOY\b/.test(line);
    const cleaned = line.replace(/\s*LOY🔥?\s*/g, '').trim();
    const colon = cleaned.indexOf(': ');
    if (colon > 0) {
      blocks.push({
        kind: 'row',
        player: normalize(cleaned.slice(0, colon)),
        pick: normalize(cleaned.slice(colon + 2)),
        loy,
        alt,
      });
      alt = !alt;
    } else {
      for (const wrapped of wrapLine(normalize(cleaned), 38)) {
        blocks.push({ kind: 'line', text: wrapped, muted: true });
      }
    }
  }
  return blocks;
}

function normalize(value: string): string {
  return value
    .replace(/[—–]/g, '-')
    .replace(/[’']/g, "'")
    .replace(/[⏳🔥•]/g, '')
    .toUpperCase();
}

function wrapLine(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const words = text.split(' ');
  const out: string[] = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > max && cur) {
      out.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function drawText(
  pixels: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  text: string,
  color: Rgba,
): void {
  let cx = x;
  for (const ch of text) {
    const glyph = FONT[ch] ?? [0x1f, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1f];
    for (let row = 0; row < CHAR_H; row++) {
      const bits = glyph[row] ?? 0;
      for (let col = 0; col < CHAR_W; col++) {
        if (bits & (1 << (CHAR_W - 1 - col))) {
          fillRect(
            pixels,
            width,
            height,
            cx + col * SCALE,
            y + row * SCALE,
            SCALE,
            SCALE,
            color,
          );
        }
      }
    }
    cx += CELL_W;
    if (cx > width - PAD) break;
  }
}

function fillRect(
  pixels: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: Rgba,
): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(width, x + w);
  const y1 = Math.min(height, y + h);
  for (let py = y0; py < y1; py++) {
    let offset = (py * width + x0) * 4;
    for (let px = x0; px < x1; px++) {
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
      offset += 4;
    }
  }
}

function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}
