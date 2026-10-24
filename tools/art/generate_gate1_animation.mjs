#!/usr/bin/env node
/** Reproducible, hand-authored pixel32 Gate 1 animation candidate. */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/art/candidates/pixel-movement/gate1-assets/pixel32-animation');
const OUT = outputDirectory(process.argv.slice(2));
const W = 32;
const H = 48;
const DIRECTIONS = ['down', 'up', 'left', 'right'];
const COLUMNS = ['idle', 'contact-a', 'passing', 'contact-b'];
const PALETTE = {
  ink: '#3c3436', outline: '#59463d', hair: '#67432f', hairLight: '#996342', skin: '#f2c99e',
  skinShade: '#d99672', shirt: '#70aaa0', shirtLight: '#9ac9b2', shirtShade: '#477a76',
  pants: '#526d87', pantsShade: '#354c64', boot: '#654537', bootLight: '#9a6848', gold: '#e8b653',
  white: '#f5e9cf',
};
const COLORS = Object.values(PALETTE).map((hex) => Number.parseInt(hex.slice(1), 16));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function outputDirectory(args) {
  if (args.length === 0) return DEFAULT_OUT;
  if (args.length !== 2 || args[0] !== '--out-dir' || !args[1] || args[1].startsWith('-')) {
    throw new Error('Usage: node generate_gate1_animation.mjs [--out-dir <directory>]');
  }
  return resolve(args[1]);
}

function canvas(width, height) {
  const pixels = new Uint8Array(width * height);
  const paint = {
    width, height, pixels,
    dot(x, y, color) {
      if (Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height) {
        pixels[y * width + x] = Object.keys(PALETTE).indexOf(color) + 1;
      }
    },
    rect(x, y, w, h, color) {
      for (let py = y; py < y + h; py += 1) for (let px = x; px < x + w; px += 1) this.dot(px, py, color);
    },
  };
  return paint;
}

function drawCharacter(direction, pose) {
  const p = canvas(W, H);
  const stride = pose === 'contact-a' ? -1 : pose === 'contact-b' ? 1 : 0;
  // Same hat and hair silhouette across views; right is mirrored after drawing left.
  p.rect(10, 5, 12, 2, 'gold'); p.rect(8, 7, 16, 2, 'gold');
  if (direction === 'down') {
    p.rect(11, 9, 10, 2, 'hair'); p.rect(9, 11, 14, 5, 'skin');
    p.rect(10, 10, 12, 2, 'hair'); p.rect(11, 13, 2, 2, 'ink'); p.rect(19, 13, 2, 2, 'ink');
    p.rect(15, 15, 2, 1, 'skinShade'); p.rect(10, 16, 12, 2, 'hairLight');
  } else if (direction === 'up') {
    p.rect(10, 9, 12, 2, 'hair'); p.rect(9, 11, 14, 5, 'hair');
    p.rect(11, 15, 10, 3, 'hairLight');
  } else {
    p.rect(10, 9, 12, 2, 'hair'); p.rect(9, 11, 13, 5, 'hair');
    p.rect(10, 11, 11, 5, 'skin'); p.rect(9, 10, 11, 2, 'hair');
    p.rect(9, 14, 4, 2, 'skinShade'); p.rect(11, 12, 2, 2, 'ink');
    p.rect(17, 16, 4, 2, 'hairLight');
  }

  // Torso, sleeves, belt and trousers stay inside the same 32x48 frame.
  p.rect(10, 18, 12, 2, 'outline'); p.rect(9, 20, 14, 10, 'shirt');
  p.rect(10, 20, 12, 2, 'shirtLight'); p.rect(12, 24, 8, 6, 'shirtShade');
  p.rect(13, 24, 6, 2, 'gold'); p.rect(10, 30, 12, 2, 'outline');
  p.rect(11, 32, 10, 9, 'pants'); p.rect(11, 32, 4, 9, 'pantsShade');
  p.rect(9, 22, 2, 7, 'skin'); p.rect(21, 22, 2, 7, 'skinShade');
  p.rect(10, 28, 3, 3, 'shirtShade'); p.rect(19, 28, 3, 3, 'shirtShade');
  p.rect(10, 24, 2, 4, 'gold');

  // Contact frames alternate the boots. Passing and idle frames meet the same baseline.
  if (pose === 'passing') {
    p.rect(13, 32, 6, 10, 'pants'); p.rect(13, 39, 6, 3, 'pantsShade');
    p.rect(11, 41, 10, 3, 'boot'); p.rect(12, 44, 8, 2, 'bootLight');
  } else if (pose === 'contact-a') {
    p.rect(8 + Math.max(0, stride), 40, 8, 4, 'boot'); p.rect(7 + Math.max(0, stride), 44, 9, 2, 'bootLight');
    p.rect(18 + Math.max(0, -stride), 40, 7, 4, 'boot'); p.rect(19 + Math.max(0, -stride), 44, 8, 2, 'bootLight');
  } else if (pose === 'contact-b') {
    p.rect(9 + Math.max(0, stride), 40, 7, 4, 'boot'); p.rect(8 + Math.max(0, stride), 44, 8, 2, 'bootLight');
    p.rect(17 + Math.max(0, -stride), 40, 8, 4, 'boot'); p.rect(18 + Math.max(0, -stride), 44, 9, 2, 'bootLight');
  } else {
    p.rect(10, 40, 5, 4, 'boot'); p.rect(9, 44, 7, 2, 'bootLight');
    p.rect(17, 40, 5, 4, 'boot'); p.rect(16, 44, 7, 2, 'bootLight');
  }
  if (direction === 'right') return mirror(p);
  return p;
}

function mirror(source) {
  const target = canvas(source.width, source.height);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) target.pixels[y * source.width + (source.width - 1 - x)] = source.pixels[y * source.width + x];
  }
  return target;
}

function blit(target, source, x, y) {
  for (let py = 0; py < source.height; py += 1) for (let px = 0; px < source.width; px += 1) {
    target.pixels[(y + py) * target.width + x + px] = source.pixels[py * source.width + px];
  }
}

function rgbaBytes(c) {
  const result = Buffer.alloc(c.pixels.length * 4);
  for (let i = 0; i < c.pixels.length; i += 1) {
    const color = COLORS[c.pixels[i] - 1];
    if (color === undefined) continue;
    result[i * 4] = color >> 16; result[i * 4 + 1] = (color >> 8) & 255;
    result[i * 4 + 2] = color & 255; result[i * 4 + 3] = 255;
  }
  return result;
}

function pixelDigest(c) {
  const output = Buffer.alloc(8 + c.width * c.height * 4);
  output.writeUInt32BE(c.width, 0); output.writeUInt32BE(c.height, 4);
  rgbaBytes(c).copy(output, 8);
  return sha256(output);
}

function pngChunk(type, data) {
  const crcTable = pngChunk.crcTable ??= Uint32Array.from({ length: 256 }, (_, n) => {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  const name = Buffer.from(type); const body = Buffer.concat([name, data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  const output = Buffer.alloc(data.length + 12); output.writeUInt32BE(data.length, 0);
  body.copy(output, 4); output.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return output;
}

function pngBytes(c) {
  const rgba = rgbaBytes(c); const rowBytes = c.width * 4;
  const raw = Buffer.alloc((rowBytes + 1) * c.height);
  for (let y = 0; y < c.height; y += 1) rgba.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  const header = Buffer.alloc(13); header.writeUInt32BE(c.width, 0); header.writeUInt32BE(c.height, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header), pngChunk('IDAT', storedZlib(raw)), pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Fixed stored-DEFLATE blocks avoid Node/zlib-version-dependent PNG bytes. */
function storedZlib(input) {
  const chunks = [Buffer.from([0x78, 0x01])];
  const maxBlockSize = 65_535;
  for (let offset = 0; offset < input.length; offset += maxBlockSize) {
    const block = input.subarray(offset, Math.min(input.length, offset + maxBlockSize));
    const final = offset + block.length === input.length;
    const header = Buffer.alloc(5);
    header[0] = final ? 1 : 0;
    header.writeUInt16LE(block.length, 1);
    header.writeUInt16LE(block.length ^ 0xffff, 3);
    chunks.push(header, block);
  }

  let a = 1;
  let b = 0;
  for (const byte of input) {
    a = (a + byte) % 65_521;
    b = (b + a) % 65_521;
  }
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(((b << 16) | a) >>> 0);
  chunks.push(checksum);
  return Buffer.concat(chunks);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const sourceHash = sha256(await (await import('node:fs/promises')).readFile(fileURLToPath(import.meta.url)));
  const sheet = canvas(W * COLUMNS.length, H * DIRECTIONS.length);
  const frames = {};
  DIRECTIONS.forEach((direction, row) => COLUMNS.forEach((pose, col) => {
    const sprite = drawCharacter(direction, pose);
    const x = col * W; const y = row * H;
    blit(sheet, sprite, x, y);
    const key = `${direction}-${pose}`;
    frames[key] = {
      x, y, width: W, height: H, nativeWidth: W, nativeHeight: H,
      footAnchor: { x: 16, y: 47 }, pivot: { x: 16, y: 47 },
      direction, pose, sha256: pixelDigest(sprite),
    };
  }));
  const sheetBytes = pngBytes(sheet);
  await writeFile(resolve(OUT, 'player-4dir.png'), sheetBytes);
  const manifest = {
    schemaVersion: 1, title: 'Dewhollow pixel32 four-direction animation candidate', status: 'candidate', approved: false,
    source: { method: 'hand-authored integer pixel primitives', generator: 'tools/art/generate_gate1_animation.mjs', generatorSha256: sourceHash },
    pixelContract: { frameWidth: W, frameHeight: H, columns: COLUMNS.length, rows: DIRECTIONS.length, sampling: 'nearest-neighbor', origin: 'top-left', rectConvention: 'half-open' },
    atlas: { file: 'player-4dir.png', width: sheet.width, height: sheet.height, sha256: sha256(sheetBytes) },
    directions: DIRECTIONS,
    frames,
    clips: {
      idle: { frames: DIRECTIONS.map((direction) => `${direction}-idle`), loop: true },
      walk: { frameDurationMs: 55, frames: DIRECTIONS.flatMap((direction) => [`${direction}-contact-a`, `${direction}-passing`, `${direction}-contact-b`, `${direction}-passing`]), loop: true },
    },
    toolFeedback: { frameSource: '../16bit.png#tool', impactAt: 0.55, reducedMotionScale: 0.4, status: 'candidate-preview-only' },
    limitations: ['Candidate art and motion only; not approved or registered as production assets.', 'Right-facing frames mirror left-facing poses; Gate 1 visual review must confirm silhouette and foot contact.', 'The preview tool overlay demonstrates timing only and does not change farming rules.'],
  };
  await writeFile(resolve(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${Object.keys(frames).length} candidate frames (${sheet.width}x${sheet.height}); generator SHA-256 ${sourceHash}`);
}

await main();
