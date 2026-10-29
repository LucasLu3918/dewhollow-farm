import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const TILE = 32;
const COLUMNS = 8;
const PALETTE = {
  ink: '#382E2D', outline: '#493936', shade: '#566B68', shadeDeep: '#48362F',
  wall: '#C79B67', wallLight: '#E0B982', wallShade: '#A97852', base: '#6E503E',
  plank: '#AF8258', plankAlt: '#A97B53', plankLight: '#C59663', plankDark: '#80583F',
  grass: '#648A53', grassLight: '#85AB67', grassDark: '#486745',
  soil: '#876047', soilLight: '#A67D57', soilDark: '#5B3C31', wetSoil: '#654A3D',
  glass: '#8FB8A7', glassLight: '#B4D1C4', glassShade: '#73979A',
  water: '#598E9B', waterLight: '#78A8A4', highlight: '#F7D8A2', gold: '#E9C276',
  hay: '#D6B77C', hayShade: '#A87967', leaf: '#567849', leafLight: '#A5B184',
};
const COLORS = Object.values(PALETTE);
const COLOR_INDEX = new Map(COLORS.map((color, index) => [color, index + 1]));

function image(width = TILE, height = TILE) {
  return {
    width, height,
    pixels: new Uint8Array(width * height),
    alpha: new Uint8Array(width * height),
    dot(x, y, color) {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const i = y * width + x;
      this.pixels[i] = COLOR_INDEX.get(color) ?? 0;
      this.alpha[i] = 255;
    },
    rect(x, y, w, h, color) {
      for (let py = y; py < y + h; py += 1) for (let px = x; px < x + w; px += 1) this.dot(px, py, color);
    },
    hline(x1, x2, y, color) { this.rect(x1, y, x2 - x1 + 1, 1, color); },
    vline(x, y1, y2, color) { this.rect(x, y1, 1, y2 - y1 + 1, color); },
    polygon(points, color) {
      const ys = points.map(([, py]) => py);
      for (let y = Math.min(...ys); y <= Math.max(...ys); y += 1) {
        const crossings = [];
        for (let i = 0; i < points.length; i += 1) {
          const [x1, y1] = points[i]; const [x2, y2] = points[(i + 1) % points.length];
          if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) crossings.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
        }
        crossings.sort((a, b) => a - b);
        for (let i = 0; i + 1 < crossings.length; i += 2) this.rect(Math.ceil(crossings[i]), y, Math.floor(crossings[i + 1]) - Math.ceil(crossings[i]) + 1, 1, color);
      }
    },
  };
}

function plankFloor(alt = false) {
  const tile = image();
  tile.rect(0, 0, TILE, TILE, alt ? PALETTE.plankAlt : PALETTE.plank);
  for (const y of [0, 8, 16, 24, 31]) {
    tile.hline(0, 31, y, PALETTE.plankDark);
    if (y < 31) tile.hline(0, 31, y + 1, PALETTE.plankLight);
  }
  for (const [x, y] of alt ? [[13, 0], [29, 8], [8, 16], [22, 24]] : [[20, 0], [7, 8], [24, 16], [12, 24]]) {
    tile.vline(x, y + 2, Math.min(y + 6, 30), PALETTE.plankDark);
  }
  return tile;
}

function plankWall() {
  const tile = image();
  tile.rect(0, 0, 32, 32, PALETTE.wall);
  tile.hline(0, 31, 0, PALETTE.ink); tile.hline(0, 31, 1, PALETTE.base);
  for (const x of [0, 7, 15, 23, 31]) {
    tile.vline(x, 2, 25, PALETTE.wallShade);
    if (x + 1 < 32) tile.vline(x + 1, 2, 25, PALETTE.wallLight);
  }
  tile.rect(0, 25, 32, 7, PALETTE.base);
  tile.hline(0, 31, 25, PALETTE.highlight);
  tile.rect(3, 28, 9, 2, PALETTE.plankDark);
  return tile;
}

function trough() {
  const tile = image();
  tile.rect(0, 0, 32, 32, PALETTE.plank);
  tile.rect(3, 8, 26, 18, PALETTE.ink);
  tile.rect(5, 10, 22, 13, PALETTE.plankDark);
  tile.rect(6, 10, 20, 3, PALETTE.plankLight);
  tile.rect(7, 14, 18, 6, PALETTE.water);
  tile.hline(8, 23, 15, PALETTE.waterLight);
  tile.rect(4, 21, 24, 3, PALETTE.plank);
  tile.rect(5, 24, 22, 3, PALETTE.ink);
  tile.rect(7, 27, 3, 2, PALETTE.shadeDeep); tile.rect(22, 27, 3, 2, PALETTE.shadeDeep);
  return tile;
}

function stallBedding() {
  const tile = image();
  tile.rect(0, 0, 32, 32, PALETTE.wetSoil);
  tile.rect(1, 1, 30, 30, PALETTE.hayShade);
  tile.rect(3, 4, 26, 22, PALETTE.hay);
  for (const [x, y, w] of [[5, 8, 7], [18, 6, 8], [9, 17, 10], [21, 20, 6]]) {
    tile.hline(x, x + w, y, PALETTE.gold);
    tile.hline(x + 1, x + w - 1, y + 1, PALETTE.hayShade);
  }
  tile.hline(2, 29, 27, PALETTE.base); tile.hline(1, 30, 30, PALETTE.ink);
  return tile;
}

function pastureGrass(variant = 0) {
  const tile = image(); tile.rect(0, 0, 32, 32, PALETTE.grass);
  const clusters = variant
    ? [[5, 7], [22, 10], [12, 23], [27, 25]]
    : [[8, 5], [23, 20], [4, 24]];
  for (const [x, y] of clusters) {
    tile.rect(x, y, 3, 1, PALETTE.grassLight);
    tile.dot(x + 1, y - 1, PALETTE.grassLight);
    tile.dot(x - 1, y + 1, PALETTE.grassDark);
    tile.dot(x + 3, y + 1, PALETTE.grassDark);
  }
  return tile;
}

function fenceHorizontal() {
  const tile = image(); tile.rect(0, 0, 32, 32, PALETTE.grass);
  tile.rect(0, 8, 32, 4, PALETTE.plankDark); tile.rect(0, 9, 32, 2, PALETTE.plank);
  tile.rect(0, 20, 32, 4, PALETTE.plankDark); tile.rect(0, 21, 32, 2, PALETTE.plank);
  for (const x of [2, 27]) { tile.rect(x, 4, 4, 24, PALETTE.base); tile.rect(x + 1, 5, 2, 21, PALETTE.plankLight); }
  return tile;
}

function fenceVertical() {
  const tile = image(); tile.rect(0, 0, 32, 32, PALETTE.grass);
  tile.rect(8, 0, 4, 32, PALETTE.plankDark); tile.rect(9, 0, 2, 32, PALETTE.plank);
  tile.rect(20, 0, 4, 32, PALETTE.plankDark); tile.rect(21, 0, 2, 32, PALETTE.plank);
  for (const y of [2, 27]) { tile.rect(4, y, 24, 4, PALETTE.base); tile.rect(5, y + 1, 21, 2, PALETTE.plankLight); }
  return tile;
}

function fenceCorner() {
  const tile = image(); tile.rect(0, 0, 32, 32, PALETTE.grass);
  tile.rect(14, 1, 4, 30, PALETTE.plankDark); tile.rect(15, 2, 2, 28, PALETTE.plankLight);
  tile.rect(1, 14, 30, 4, PALETTE.plankDark); tile.rect(2, 15, 28, 2, PALETTE.plank);
  tile.rect(11, 11, 10, 10, PALETTE.base); tile.rect(13, 13, 6, 6, PALETTE.plankLight);
  return tile;
}

function pasturePath() {
  const tile = pastureGrass(0);
  tile.rect(0, 11, 32, 10, PALETTE.soilDark);
  tile.rect(0, 12, 32, 7, PALETTE.soil);
  tile.hline(0, 31, 12, PALETTE.soilLight);
  tile.rect(5, 15, 4, 1, PALETTE.hayShade); tile.rect(22, 17, 5, 1, PALETTE.soilLight);
  return tile;
}

function waterEdge() {
  const tile = image(); tile.rect(0, 0, 32, 32, PALETTE.water);
  tile.rect(0, 0, 32, 10, PALETTE.grass);
  tile.rect(0, 8, 32, 3, PALETTE.shadeDeep);
  tile.hline(0, 4, 7, PALETTE.grassLight); tile.hline(8, 15, 8, PALETTE.grassLight);
  tile.hline(17, 23, 7, PALETTE.grassLight); tile.hline(26, 31, 8, PALETTE.grassLight);
  tile.rect(3, 9, 5, 3, PALETTE.shadeDeep); tile.rect(11, 8, 7, 4, PALETTE.soilLight);
  tile.rect(23, 9, 6, 3, PALETTE.shadeDeep);
  tile.hline(6, 13, 16, PALETTE.waterLight); tile.hline(20, 26, 23, PALETTE.glass);
  return tile;
}

function pastureWall() {
  const tile = image(); tile.rect(0, 0, 32, 32, PALETTE.wall);
  tile.hline(0, 31, 1, PALETTE.ink);
  for (const y of [6, 13, 20]) { tile.hline(1, 30, y, PALETTE.wallShade); tile.hline(1, 30, y + 1, PALETTE.wallLight); }
  tile.vline(1, 2, 28, PALETTE.base); tile.vline(30, 2, 28, PALETTE.base);
  tile.rect(0, 28, 32, 4, PALETTE.base);
  return tile;
}

function greenhouseBack() {
  const tile = image(); tile.rect(0, 0, 32, 32, PALETTE.glassShade);
  tile.rect(3, 2, 26, 25, PALETTE.glass);
  tile.rect(5, 4, 9, 20, PALETTE.glassLight); tile.rect(17, 4, 10, 20, PALETTE.glass);
  tile.vline(2, 1, 27, PALETTE.base); tile.vline(15, 1, 27, PALETTE.base); tile.vline(29, 1, 27, PALETTE.base);
  tile.hline(2, 29, 2, PALETTE.plankDark); tile.hline(3, 28, 3, PALETTE.plankLight);
  tile.rect(0, 27, 32, 5, PALETTE.base); tile.hline(1, 30, 27, PALETTE.plankLight);
  tile.rect(7, 8, 4, 2, PALETTE.highlight); tile.rect(21, 15, 3, 2, PALETTE.glassLight);
  return tile;
}

function greenhouseFront() {
  const tile = image(); tile.rect(0, 0, 32, 32, PALETTE.glassShade);
  tile.rect(3, 1, 26, 26, PALETTE.glass);
  tile.rect(5, 3, 20, 21, PALETTE.glassLight);
  tile.rect(13, 2, 4, 24, PALETTE.base); tile.hline(3, 28, 13, PALETTE.base);
  tile.rect(0, 26, 32, 6, PALETTE.base); tile.hline(1, 30, 26, PALETTE.highlight);
  tile.rect(5, 6, 4, 2, PALETTE.highlight); tile.rect(20, 17, 4, 2, PALETTE.glassShade);
  return tile;
}

function greenhouseGround() {
  const tile = image(); tile.rect(0, 0, 32, 32, PALETTE.wetSoil);
  tile.hline(2, 29, 3, PALETTE.soilLight); tile.hline(2, 29, 28, PALETTE.soilDark);
  tile.rect(4, 8, 24, 16, PALETTE.soil);
  tile.hline(5, 26, 9, PALETTE.soilLight); tile.hline(5, 26, 22, PALETTE.soilDark);
  tile.rect(8, 13, 3, 2, PALETTE.grassDark); tile.rect(20, 17, 4, 2, PALETTE.leaf);
  tile.dot(9, 12, PALETTE.grassLight); tile.dot(21, 16, PALETTE.leafLight);
  return tile;
}

function greenhouseGlass() {
  const tile = image(); tile.rect(0, 0, 32, 32, PALETTE.glass);
  tile.rect(2, 2, 28, 28, PALETTE.glassLight);
  tile.rect(4, 4, 10, 24, PALETTE.glass); tile.rect(18, 4, 10, 24, PALETTE.glass);
  tile.vline(15, 1, 30, PALETTE.base); tile.vline(16, 1, 30, PALETTE.plankLight);
  tile.hline(1, 30, 15, PALETTE.base); tile.hline(2, 29, 16, PALETTE.plankLight);
  tile.rect(5, 6, 4, 2, PALETTE.highlight); tile.rect(21, 21, 4, 2, PALETTE.waterLight);
  return tile;
}

function greenhouseDoor() {
  const tile = image(); tile.rect(0, 0, 32, 32, PALETTE.wall);
  tile.rect(5, 1, 22, 31, PALETTE.base); tile.rect(7, 3, 18, 29, PALETTE.plankDark);
  tile.rect(9, 5, 14, 24, PALETTE.plank);
  tile.rect(10, 7, 12, 7, PALETTE.glassShade); tile.rect(11, 8, 10, 5, PALETTE.glassLight);
  tile.hline(8, 23, 15, PALETTE.base); tile.vline(16, 16, 28, PALETTE.plankLight);
  tile.dot(21, 23, PALETTE.gold); tile.rect(3, 29, 26, 3, PALETTE.ink);
  return tile;
}

const DEFINITIONS = [
  ['coop-floor-a', 'ground', plankFloor(false)],
  ['coop-floor-b', 'ground', plankFloor(true)],
  ['coop-wall', 'object', plankWall()],
  ['coop-trough', 'object', trough()],
  ['coop-stall', 'ground', stallBedding()],
  ['pasture-grass', 'ground', pastureGrass(0)],
  ['pasture-grass-variant', 'ground', pastureGrass(1)],
  ['pasture-fence-horizontal', 'object', fenceHorizontal()],
  ['pasture-fence-vertical', 'object', fenceVertical()],
  ['pasture-fence-corner', 'object', fenceCorner()],
  ['pasture-path', 'ground', pasturePath()],
  ['pasture-water-edge', 'ground', waterEdge()],
  ['pasture-wall', 'object', pastureWall()],
  ['greenhouse-back', 'object', greenhouseBack()],
  ['greenhouse-front', 'object', greenhouseFront()],
  ['greenhouse-ground', 'ground', greenhouseGround()],
  ['greenhouse-glass', 'object', greenhouseGlass()],
  ['greenhouse-door', 'object', greenhouseDoor()],
];

function rgbaBytes(frameImages) {
  const width = COLUMNS * TILE;
  const height = Math.ceil(frameImages.length / COLUMNS) * TILE;
  const rgba = Buffer.alloc(width * height * 4);
  const rgb = COLORS.map((hex) => Number.parseInt(hex.slice(1), 16));
  for (let frameIndex = 0; frameIndex < frameImages.length; frameIndex += 1) {
    const frame = frameImages[frameIndex];
    const originX = (frameIndex % COLUMNS) * TILE;
    const originY = Math.floor(frameIndex / COLUMNS) * TILE;
    for (let y = 0; y < TILE; y += 1) for (let x = 0; x < TILE; x += 1) {
      const sourceIndex = y * TILE + x;
      const targetIndex = ((originY + y) * width + originX + x) * 4;
      const color = rgb[frame.pixels[sourceIndex] - 1];
      if (color === undefined || frame.alpha[sourceIndex] === 0) continue;
      rgba[targetIndex] = color >> 16;
      rgba[targetIndex + 1] = (color >> 8) & 255;
      rgba[targetIndex + 2] = color & 255;
      rgba[targetIndex + 3] = frame.alpha[sourceIndex];
    }
  }
  return { width, height, rgba };
}

function crc32(bytes) {
  const table = crc32.table ??= Uint32Array.from({ length: 256 }, (_, n) => {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, bytes) {
  const typeBytes = Buffer.from(type);
  const payload = Buffer.concat([typeBytes, bytes]);
  const result = Buffer.alloc(bytes.length + 12);
  result.writeUInt32BE(bytes.length, 0); payload.copy(result, 4); result.writeUInt32BE(crc32(payload), bytes.length + 8);
  return result;
}

function storedZlib(bytes) {
  const chunks = [Buffer.from([0x78, 0x01])];
  for (let offset = 0; offset < bytes.length; offset += 65535) {
    const block = bytes.subarray(offset, Math.min(offset + 65535, bytes.length));
    const header = Buffer.alloc(5);
    header[0] = offset + block.length === bytes.length ? 1 : 0;
    header.writeUInt16LE(block.length, 1); header.writeUInt16LE(block.length ^ 0xffff, 3);
    chunks.push(header, block);
  }
  let a = 1; let b = 0;
  for (const byte of bytes) { a = (a + byte) % 65521; b = (b + a) % 65521; }
  const adler = Buffer.alloc(4); adler.writeUInt32BE(((b << 16) | a) >>> 0); chunks.push(adler);
  return Buffer.concat(chunks);
}

function pngBytes({ width, height, rgba }) {
  const stride = width * 4; const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) rgba.copy(scanlines, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const compressed = storedZlib(scanlines);
  const chunks = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header)];
  for (let offset = 0; offset < compressed.length; offset += 64 * 1024) chunks.push(chunk('IDAT', compressed.subarray(offset, offset + 64 * 1024)));
  chunks.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

async function main() {
  await mkdir(ROOT, { recursive: true });
  const { width, height, rgba } = rgbaBytes(DEFINITIONS.map(([, , frame]) => frame));
  const atlas = pngBytes({ width, height, rgba });
  const generator = await readFile(fileURLToPath(import.meta.url));
  const frames = Object.fromEntries(DEFINITIONS.map(([id, layer], index) => [id, {
    x: (index % COLUMNS) * TILE,
    y: Math.floor(index / COLUMNS) * TILE,
    width: TILE,
    height: TILE,
    nativeWidth: TILE,
    nativeHeight: TILE,
    displayScale: 2,
    approved: false,
    layer,
    tileable: ['coop-floor-a', 'coop-floor-b', 'coop-wall', 'coop-stall', 'pasture-grass', 'pasture-grass-variant', 'pasture-path', 'pasture-water-edge', 'pasture-wall', 'greenhouse-ground', 'greenhouse-back', 'greenhouse-front', 'greenhouse-glass'].includes(id),
  }]));
  const manifest = {
    schemaVersion: 1,
    id: 'dewhollow-p6-062-farm-interiors-candidate',
    title: 'Dewhollow Pixel32 farm interiors and pasture candidate',
    status: 'candidate',
    approved: false,
    source: {
      method: 'hand-authored integer pixel primitives with deterministic PNG encoding',
      generator: 'generate.mjs',
      generatorSha256: sha256(generator),
    },
    pixelContract: {
      nativeTileSize: TILE,
      worldTileSize: 64,
      displayScale: 2,
      sampling: 'nearest-neighbor',
      origin: 'top-left',
      rectConvention: 'half-open',
      anchorConvention: 'integer-pixel-index',
    },
    palette: PALETTE,
    atlas: { file: 'atlas.png', width, height, sha256: sha256(atlas) },
    frames,
    approval: { exactAssetApproved: false, productionIntegrationAllowed: false },
  };
  await writeFile(resolve(ROOT, 'atlas.png'), atlas);
  await writeFile(resolve(ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${DEFINITIONS.length} 32x32 candidate frames; atlas SHA-256 ${manifest.atlas.sha256}`);
}

await main();
