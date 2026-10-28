import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(ROOT, 'lake-shore-tile-source.png');
const SOURCE_SHA256 = 'e24dc1aa559795ec4c746de9b6ba55acf6febcffb5a0a0756f1a3811666c7628';
const TILE = 32;
const ATLAS_SIZE = TILE * 4;
const SOURCE_CELL = 310;
const CELL_ORIGINS = [1, 315, 628, 942];
const WATER_BASE = [26, 110, 144];
const FRAME_IDS = [
  'water-open', 'water-ripple-small', 'water-stone', 'water-lily',
  'shore-north', 'shore-east', 'shore-south', 'shore-west',
  'shore-corner-nw', 'shore-basin', 'shore-shallow-rocks', 'shore-corner-ne',
  'shore-reeds', 'water-pebbles', 'shore-reed-clump', 'fishing-ripple',
];

function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('source is not PNG');
  let width = 0; let height = 0; let bitDepth = 0; let colorType = 0; let interlace = 0; const idat = [];
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset); const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    offset += length + 12;
  }
  if (bitDepth !== 8 || colorType !== 2 || interlace !== 0) throw new Error('expected non-interlaced 8-bit RGB PNG');
  const bpp = 3; const stride = width * bpp; const filtered = inflateSync(Buffer.concat(idat)); const pixels = Buffer.alloc(height * stride);
  let input = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = filtered[input++];
    for (let x = 0; x < stride; x += 1) {
      const raw = filtered[input++]; const left = x >= bpp ? pixels[y * stride + x - bpp] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= bpp ? pixels[(y - 1) * stride + x - bpp] : 0;
      let value = raw;
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) {
        const predictor = left + up - upperLeft;
        const dl = Math.abs(predictor - left); const du = Math.abs(predictor - up); const dul = Math.abs(predictor - upperLeft);
        value += dl <= du && dl <= dul ? left : du <= dul ? up : upperLeft;
      } else if (filter !== 0) throw new Error(`unsupported PNG filter ${filter}`);
      pixels[y * stride + x] = value & 255;
    }
  }
  return { width, height, pixels };
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type); const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
function encodeZlibStored(data) {
  const parts = [Buffer.from([0x78, 0x01])];
  for (let offset = 0; offset < data.length;) {
    const length = Math.min(65535, data.length - offset); const final = offset + length >= data.length;
    const header = Buffer.alloc(5); header[0] = final ? 1 : 0;
    header.writeUInt16LE(length, 1); header.writeUInt16LE((~length) & 0xffff, 3);
    parts.push(header, data.subarray(offset, offset + length)); offset += length;
  }
  let a = 1; let b = 0;
  for (const value of data) { a = (a + value) % 65521; b = (b + a) % 65521; }
  const adler = Buffer.alloc(4); adler.writeUInt32BE(((b << 16) | a) >>> 0);
  parts.push(adler);
  return Buffer.concat(parts);
}
function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 2; header[10] = 0; header[11] = 0; header[12] = 0;
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) pixels.copy(rows, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', encodeZlibStored(rows)), chunk('IEND', Buffer.alloc(0))]);
}
function waterLike(r, g, b) {
  return b >= 72 && g >= 38 && b - r >= 48 && g - r >= 18 && b >= g * 0.88;
}
function calmWater() {
  return WATER_BASE;
}
function setPixel(frame, x, y, color) {
  const offset = (y * TILE + x) * 3;
  frame[offset] = color[0]; frame[offset + 1] = color[1]; frame[offset + 2] = color[2];
}
function addQuietRipples(frame, style) {
  const light = [32, 118, 149]; const shade = [23, 103, 132];
  if (style === 'small') {
    for (const [x, y, width] of [[5, 7, 5], [19, 15, 6], [8, 24, 4]]) {
      for (let dx = 0; dx < width; dx += 1) setPixel(frame, x + dx, y, dx === 0 || dx === width - 1 ? shade : light);
      if (width > 4) setPixel(frame, x + 1, y + 1, light);
    }
  } else if (style === 'fishing') {
    for (const [x, y, width] of [[11, 9, 7], [9, 10, 2], [18, 10, 2], [13, 21, 5], [11, 22, 2], [18, 22, 2]]) {
      for (let dx = 0; dx < width; dx += 1) setPixel(frame, x + dx, y, light);
    }
  }
}
function canonicalFrameSha(pixels) {
  const size = Buffer.alloc(8); size.writeUInt32BE(TILE, 0); size.writeUInt32BE(TILE, 4);
  return createHash('sha256').update(size).update(pixels).digest('hex');
}

const sourceBytes = await readFile(SOURCE_FILE);
const sourceHash = createHash('sha256').update(sourceBytes).digest('hex');
if (sourceHash !== SOURCE_SHA256) throw new Error(`source hash mismatch: ${sourceHash}`);
const source = decodePng(sourceBytes);
if (source.width !== 1254 || source.height !== 1254) throw new Error(`unexpected source dimensions ${source.width}x${source.height}`);
const atlasPixels = Buffer.alloc(ATLAS_SIZE * ATLAS_SIZE * 3);
const frames = {};
for (let index = 0; index < FRAME_IDS.length; index += 1) {
  const id = FRAME_IDS[index]; const col = index % 4; const row = Math.floor(index / 4);
  const sx0 = CELL_ORIGINS[col]; const sy0 = CELL_ORIGINS[row]; const frame = Buffer.alloc(TILE * TILE * 3);
  for (let y = 0; y < TILE; y += 1) for (let x = 0; x < TILE; x += 1) {
    // Pixel-center nearest-neighbor sampling is deterministic and keeps the original crisp 32px contract.
    const sx = sx0 + Math.floor((x + 0.5) * SOURCE_CELL / TILE);
    const sy = sy0 + Math.floor((y + 0.5) * SOURCE_CELL / TILE);
    const sourceOffset = (sy * source.width + sx) * 3; const targetOffset = (y * TILE + x) * 3;
    let [r, g, b] = source.pixels.subarray(sourceOffset, sourceOffset + 3);
    if (index === 0) {
      // Calm open water is intentionally a quiet base; variation lives in sparse feature tiles.
      [r, g, b] = WATER_BASE;
    } else if (waterLike(r, g, b)) {
      [r, g, b] = calmWater(r, g, b);
    }
    frame[targetOffset] = r; frame[targetOffset + 1] = g; frame[targetOffset + 2] = b;
  }
  if (id === 'water-ripple-small') addQuietRipples(frame, 'small');
  if (id === 'fishing-ripple') addQuietRipples(frame, 'fishing');
  for (let y = 0; y < TILE; y += 1) for (let x = 0; x < TILE; x += 1) {
    const sourceOffset = (y * TILE + x) * 3;
    const atlasOffset = ((row * TILE + y) * ATLAS_SIZE + col * TILE + x) * 3;
    frame.copy(atlasPixels, atlasOffset, sourceOffset, sourceOffset + 3);
  }
  const layer = index < 4 ? 'ground' : index < 12 ? 'shore' : 'ground';
  frames[id] = { x: col * TILE, y: row * TILE, width: TILE, height: TILE, approved: false, layer, tileable: layer === 'ground', sha256: canonicalFrameSha(frame) };
}
const atlas = encodePng(ATLAS_SIZE, ATLAS_SIZE, atlasPixels);
const generatorBytes = await readFile(fileURLToPath(import.meta.url));
const manifest = {
  schemaVersion: 1,
  id: 'dewhollow-p6-lake-shore-candidate',
  title: '月鏡湖畔 Pixel32 岸線圖塊候選',
  status: 'candidate', approved: false,
  source: {
    method: 'deterministic nearest-neighbor crops from the user-approved visual-direction candidate, with flat quiet water with manually authored low-contrast ripples',
    file: 'lake-shore-tile-source.png', sha256: sourceHash, dimensions: { width: source.width, height: source.height },
    generator: 'generate.mjs', generatorSha256: createHash('sha256').update(generatorBytes).digest('hex'),
    atlasDerivation: 'Sixteen 310x310 source cells (origins 1,315,628,942) are sampled at pixel centers to 32x32 and packed row-major. Water-only pixels normalize to a shared calm base blue; small low-contrast ripples are added only to the ripple frames. Shoreline geometry, reeds, stones, lily and ripple details are retained from the candidate source.',
  },
  pixelContract: { nativeTileSize: 32, worldTileSize: 64, displayScale: 2, sampling: 'nearest-neighbor', origin: 'top-left', rectConvention: 'half-open', alpha: 'RGB; opaque tile pixels' },
  atlas: { file: 'atlas.png', width: ATLAS_SIZE, height: ATLAS_SIZE, sha256: createHash('sha256').update(atlas).digest('hex') },
  frames,
  notes: [
    'All source water colors normalize to the same quiet blue base; only the dedicated ripple frames add a few low-contrast authored marks, eliminating cyan texture squares in repeated map cells.',
    'Cardinal shoreline and corner tile frames are retained; their visible water area is normalized to the same calm palette while the original shore silhouette, stones and plants remain.',
    'The lake map itself remains rectangular. No tile-only candidate can extend shoreline beyond the existing map boundary; the atlas makes that boundary read as a continuous bank without changing topology.',
  ],
};
await writeFile(resolve(ROOT, 'atlas.png'), atlas);
await writeFile(resolve(ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`generated ${FRAME_IDS.length} frames, ${ATLAS_SIZE}x${ATLAS_SIZE}, sha256:${manifest.atlas.sha256}`);
