#!/usr/bin/env node
/** Reproducible, hand-authored pixel32 cat and quokka animation candidates. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/art/candidates/pixel-movement/gate1-pets-pixel32');
const W = 32;
const H = 32;
const SPECIES = ['cat', 'quokka'];
const DIRECTIONS = ['down', 'up', 'left', 'right'];
const POSES = ['idle', 'hop-a', 'hop-b', 'land'];
const PALETTE = {
  ink: '#302b31', cat: '#222126', catLight: '#39353d', catDark: '#17171c', gold: '#f2c65c', pupil: '#26252a',
  nose: '#df8c9a', whisker: '#b9aead', quokka: '#88715f', quokkaLight: '#aa8d74', quokkaDark: '#675448',
  muzzle: '#dbc4a5', muzzleShade: '#bb987d', innerEar: '#c7837c',
};
const COLORS = Object.values(PALETTE).map((hex) => Number.parseInt(hex.slice(1), 16));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function outputDirectory(args) {
  if (args.length === 0) return DEFAULT_OUT;
  if (args.length !== 2 || args[0] !== '--out-dir' || !args[1] || args[1].startsWith('-')) {
    throw new Error('Usage: node generate_gate1_pets_pixel32.mjs [--out-dir <directory>]');
  }
  return resolve(args[1]);
}

function canvas(width = W, height = H) {
  const pixels = new Uint8Array(width * height);
  return {
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
}

function mirror(source) {
  const target = canvas(source.width, source.height);
  for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) {
    target.pixels[y * source.width + (source.width - 1 - x)] = source.pixels[y * source.width + x];
  }
  return target;
}

function drawCat(direction, pose) {
  const p = canvas();
  const lift = pose === 'hop-a' || pose === 'hop-b' ? -1 : 0;
  // Tail silhouette and low, four-legged body.
  p.rect(8, 21 + lift, 2, 3, 'catDark'); p.rect(7, 19 + lift, 2, 3, 'cat'); p.rect(6, 17 + lift, 2, 3, 'catDark');
  p.rect(9, 16 + lift, 13, 8, 'catDark'); p.rect(10, 17 + lift, 11, 6, 'cat');
  p.rect(12, 18 + lift, 7, 2, 'catLight'); p.rect(11, 21 + lift, 9, 2, 'cat');
  const stride = pose === 'hop-a' ? -1 : pose === 'hop-b' ? 1 : pose === 'land' ? 2 : 0;
  p.rect(10 + stride, 23 + lift, 3, 4 - lift, 'catDark'); p.rect(18 - stride, 23 + lift, 3, 4 - lift, 'catDark');
  p.rect(9 + stride, 27, 5, 2, 'cat'); p.rect(17 - stride, 27, 5, 2, 'cat');

  if (direction === 'down') {
    p.rect(11, 9 + lift, 4, 4, 'ink'); p.rect(17, 9 + lift, 4, 4, 'ink');
    p.rect(12, 10 + lift, 2, 2, 'innerEar'); p.rect(18, 10 + lift, 2, 2, 'innerEar');
    p.rect(10, 12 + lift, 12, 7, 'catDark'); p.rect(11, 12 + lift, 10, 6, 'cat');
    p.rect(12, 13 + lift, 3, 3, 'gold'); p.rect(17, 13 + lift, 3, 3, 'gold');
    p.rect(13, 14 + lift, 1, 2, 'pupil'); p.rect(18, 14 + lift, 1, 2, 'pupil');
    p.dot(16, 16 + lift, 'nose'); p.rect(14, 17 + lift, 2, 1, 'whisker'); p.rect(16, 17 + lift, 2, 1, 'whisker');
    p.rect(8, 17 + lift, 3, 1, 'whisker'); p.rect(21, 17 + lift, 3, 1, 'whisker');
  } else if (direction === 'up') {
    p.rect(11, 9 + lift, 4, 4, 'ink'); p.rect(17, 9 + lift, 4, 4, 'ink');
    p.rect(12, 10 + lift, 2, 2, 'innerEar'); p.rect(18, 10 + lift, 2, 2, 'innerEar');
    p.rect(10, 12 + lift, 12, 7, 'catDark'); p.rect(11, 12 + lift, 10, 6, 'cat');
    p.rect(12, 14 + lift, 8, 2, 'catLight');
  } else {
    p.rect(9, 11 + lift, 4, 4, 'ink'); p.rect(10, 12 + lift, 2, 2, 'innerEar');
    p.rect(10, 13 + lift, 12, 7, 'catDark'); p.rect(11, 14 + lift, 10, 5, 'cat');
    p.rect(13, 14 + lift, 2, 2, 'gold'); p.rect(14, 14 + lift, 1, 2, 'pupil');
    p.rect(20, 17 + lift, 3, 2, 'catDark'); p.rect(22, 18 + lift, 2, 1, 'nose');
    p.rect(20, 19 + lift, 4, 1, 'whisker'); p.rect(8, 18 + lift, 3, 1, 'whisker');
  }
  return direction === 'right' ? mirror(p) : p;
}

function drawQuokka(direction, pose) {
  const p = canvas();
  const lift = pose === 'hop-a' || pose === 'hop-b' ? -1 : 0;
  const stride = pose === 'hop-a' ? -1 : pose === 'hop-b' ? 1 : pose === 'land' ? 2 : 0;
  // Compact rump, substantial hindquarters and a visible naturally curved tail.
  p.rect(7, 21 + lift, 3, 2, 'quokkaDark'); p.rect(6, 19 + lift, 2, 3, 'quokka'); p.rect(5, 18 + lift, 2, 2, 'quokkaDark');
  p.rect(9, 17 + lift, 14, 7, 'quokkaDark'); p.rect(10, 18 + lift, 12, 5, 'quokka');
  p.rect(13, 19 + lift, 7, 2, 'quokkaLight'); p.rect(11, 22 + lift, 9, 2, 'quokka');
  p.rect(10 + stride, 23 + lift, 3, 4 - lift, 'quokkaDark'); p.rect(18 - stride, 23 + lift, 3, 4 - lift, 'quokkaDark');
  p.rect(9 + stride, 27, 5, 2, 'quokka'); p.rect(17 - stride, 27, 5, 2, 'quokka');

  if (direction === 'down') {
    p.rect(11, 11 + lift, 4, 4, 'quokkaDark'); p.rect(17, 11 + lift, 4, 4, 'quokkaDark');
    p.rect(12, 12 + lift, 2, 2, 'innerEar'); p.rect(18, 12 + lift, 2, 2, 'innerEar');
    p.rect(10, 14 + lift, 12, 7, 'quokkaDark'); p.rect(11, 14 + lift, 10, 6, 'quokkaLight');
    p.rect(12, 15 + lift, 8, 4, 'muzzle'); p.rect(13, 15 + lift, 6, 2, 'quokkaLight');
    p.rect(13, 14 + lift, 2, 2, 'ink'); p.rect(17, 14 + lift, 2, 2, 'ink');
    p.rect(15, 18 + lift, 2, 1, 'quokkaDark'); p.rect(14, 19 + lift, 4, 1, 'muzzleShade');
  } else if (direction === 'up') {
    p.rect(11, 11 + lift, 4, 4, 'quokkaDark'); p.rect(17, 11 + lift, 4, 4, 'quokkaDark');
    p.rect(12, 12 + lift, 2, 2, 'innerEar'); p.rect(18, 12 + lift, 2, 2, 'innerEar');
    p.rect(10, 14 + lift, 12, 7, 'quokkaDark'); p.rect(11, 14 + lift, 10, 6, 'quokka');
    p.rect(13, 16 + lift, 6, 2, 'quokkaLight');
  } else {
    p.rect(10, 13 + lift, 4, 4, 'quokkaDark'); p.rect(11, 14 + lift, 2, 2, 'innerEar');
    p.rect(10, 15 + lift, 13, 6, 'quokkaDark'); p.rect(11, 16 + lift, 11, 4, 'quokkaLight');
    p.rect(14, 16 + lift, 5, 3, 'muzzle'); p.rect(12, 16 + lift, 2, 2, 'ink');
    p.rect(21, 18 + lift, 3, 2, 'muzzleShade'); p.dot(23, 18 + lift, 'quokkaDark');
  }
  return direction === 'right' ? mirror(p) : p;
}

function draw(species, direction, pose) {
  return species === 'cat' ? drawCat(direction, pose) : drawQuokka(direction, pose);
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
    result[i * 4] = color >> 16; result[i * 4 + 1] = (color >> 8) & 255; result[i * 4 + 2] = color & 255; result[i * 4 + 3] = 255;
  }
  return result;
}

function pixelDigest(c) {
  const output = Buffer.alloc(8 + c.width * c.height * 4);
  output.writeUInt32BE(c.width, 0); output.writeUInt32BE(c.height, 4); rgbaBytes(c).copy(output, 8);
  return sha256(output);
}

function pngChunk(type, data) {
  const crcTable = pngChunk.crcTable ??= Uint32Array.from({ length: 256 }, (_, n) => {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  const body = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  const output = Buffer.alloc(data.length + 12); output.writeUInt32BE(data.length, 0); body.copy(output, 4); output.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return output;
}

function storedZlib(input) {
  const chunks = [Buffer.from([0x78, 0x01])];
  for (let offset = 0; offset < input.length; offset += 65_535) {
    const block = input.subarray(offset, Math.min(input.length, offset + 65_535));
    const header = Buffer.alloc(5); header[0] = offset + block.length === input.length ? 1 : 0;
    header.writeUInt16LE(block.length, 1); header.writeUInt16LE(block.length ^ 0xffff, 3); chunks.push(header, block);
  }
  let a = 1; let b = 0;
  for (const byte of input) { a = (a + byte) % 65_521; b = (b + a) % 65_521; }
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(((b << 16) | a) >>> 0); chunks.push(checksum);
  return Buffer.concat(chunks);
}

function pngBytes(c) {
  const rgba = rgbaBytes(c); const rowBytes = c.width * 4; const raw = Buffer.alloc((rowBytes + 1) * c.height);
  for (let y = 0; y < c.height; y += 1) rgba.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  const header = Buffer.alloc(13); header.writeUInt32BE(c.width, 0); header.writeUInt32BE(c.height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', storedZlib(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

async function main() {
  const out = outputDirectory(process.argv.slice(2));
  await mkdir(out, { recursive: true });
  const sourceHash = sha256(await readFile(fileURLToPath(import.meta.url)));
  const columns = SPECIES.length * POSES.length;
  const sheet = canvas(W * columns, H * DIRECTIONS.length);
  const frames = {};
  DIRECTIONS.forEach((direction, row) => SPECIES.forEach((species, speciesIndex) => POSES.forEach((pose, poseIndex) => {
    const col = speciesIndex * POSES.length + poseIndex;
    const sprite = draw(species, direction, pose); const x = col * W; const y = row * H;
    blit(sheet, sprite, x, y);
    const key = `${species}-${direction}-${pose}`;
    frames[key] = { species, direction, pose, x, y, width: W, height: H, nativeWidth: W, nativeHeight: H, footAnchor: { x: 16, y: 28 }, pivot: { x: 16, y: 28 }, sha256: pixelDigest(sprite) };
  })));
  const atlasBytes = pngBytes(sheet);
  await writeFile(resolve(out, 'pets-pixel32.png'), atlasBytes);
  const manifest = {
    schemaVersion: 1,
    title: 'Dewhollow pixel32 black cat and quokka candidate animation atlas',
    status: 'candidate',
    approved: false,
    source: { method: 'hand-authored integer pixel primitives; approved static assets used only as species references', generator: 'tools/art/generate_gate1_pets_pixel32.mjs', generatorSha256: sourceHash },
    pixelContract: { frameWidth: W, frameHeight: H, columns, rows: DIRECTIONS.length, sampling: 'nearest-neighbor', origin: 'top-left', rectConvention: 'half-open', displayScale: 2 },
    atlas: { file: 'pets-pixel32.png', width: sheet.width, height: sheet.height, sha256: sha256(atlasBytes) },
    species: SPECIES,
    directions: DIRECTIONS,
    poses: POSES,
    frames,
    clips: Object.fromEntries(SPECIES.map((species) => [species, {
      idle: { loop: true, frames: DIRECTIONS.map((direction) => `${species}-${direction}-idle`) },
      hop: { loop: true, frameDurationMs: 130, frames: DIRECTIONS.flatMap((direction) => [`${species}-${direction}-hop-a`, `${species}-${direction}-hop-b`, `${species}-${direction}-land`, `${species}-${direction}-idle`]) },
    }])),
    referenceAssets: {
      cat: { file: 'public/assets/characters/cat-2x.png', purpose: 'species traits only; new directions and animation are not approved', sha256: 'e128d8295d4d1fc8cf3ff52dc70d176b3b0ea8b6087a6f350b6feeef4c8468e5' },
      quokka: { file: 'public/assets/characters/marsupial-2x.png', purpose: 'species traits only; new directions and animation are not approved', sha256: '614fc13c48dab042962c7dc39f2353890d5f038e04076205a99cad27aed822d7' },
    },
    limitations: [
      'Candidate-only original pixel art; not approved or registered as production assets.',
      'Approved static reference images inform species traits only; no approval transfers to these frames, directions, poses, or atlas.',
      'Generated poses are mechanical review samples and require human identity, anatomy, foot-anchor, and rendered-size review.',
      'This isolated preview has no game runtime or companion-follow integration.',
    ],
  };
  await writeFile(resolve(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${Object.keys(frames).length} candidate pet frames (${sheet.width}x${sheet.height}); generator SHA-256 ${sourceHash}`);
}

await main();
