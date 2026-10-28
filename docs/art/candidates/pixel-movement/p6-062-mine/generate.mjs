import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));
const TILE = 32;
const COLUMNS = 8;
const ROWS = 2;
const WIDTH = COLUMNS * TILE;
const HEIGHT = ROWS * TILE;
const C = {
  floor: '#666B63', floorLight: '#85877A', floorDark: '#4B514D',
  wall: '#77796E', wallLight: '#A5A18A', wallDark: '#444943',
  rock: '#817E70', rockLight: '#B0A58C', rockDark: '#514D48',
  ink: '#382E2D', shadow: '#566B68', wood: '#805B43', woodLight: '#B18759',
  glow: '#F7D8A2', copper: '#C87847', copperLight: '#E4A05B',
  silver: '#9DAFB0', silverLight: '#D2D9C7', gold: '#D5A749', goldLight: '#F0D079',
  lanternGlow: '#E9C276',
};
const PALETTE = [...new Set(Object.values(C))];
const paletteIndex = new Map(PALETTE.map((color, index) => [color, index + 1]));

function image(width, height) {
  return {
    width, height,
    pixels: new Uint8Array(width * height),
    alpha: new Uint8Array(width * height),
    dot(x, y, color, alpha = 255) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) return;
      const i = y * width + x;
      this.pixels[i] = paletteIndex.get(color) ?? 0;
      this.alpha[i] = alpha;
    },
    rect(x, y, w, h, color) {
      for (let py = y; py < y + h; py += 1) for (let px = x; px < x + w; px += 1) this.dot(px, py, color);
    },
    blit(source, x, y) {
      for (let py = 0; py < source.height; py += 1) for (let px = 0; px < source.width; px += 1) {
        const from = py * source.width + px;
        if (!source.alpha[from]) continue;
        const toX = x + px; const toY = y + py;
        if (toX < 0 || toY < 0 || toX >= width || toY >= height) continue;
        const to = toY * width + toX;
        this.pixels[to] = source.pixels[from]; this.alpha[to] = source.alpha[from];
      }
    },
  };
}

function tile(base) {
  const out = image(TILE, TILE); out.rect(0, 0, TILE, TILE, base); return out;
}

function caveFloor() {
  const out = tile(C.floor);
  out.rect(1, 1, 30, 1, C.floorLight); out.rect(1, 30, 30, 1, C.floorDark);
  for (const [x, y, color] of [[5, 7, C.floorDark], [6, 7, C.floorLight], [21, 12, C.floorDark], [22, 12, C.floorLight], [12, 23, C.floorDark], [24, 25, C.floorLight]]) out.dot(x, y, color);
  return out;
}

function caveWall() {
  const out = tile(C.wallDark);
  out.rect(0, 0, 32, 7, C.ink); out.rect(0, 7, 32, 2, C.wallDark);
  for (const [x, y, w, h] of [[2, 10, 10, 8], [14, 9, 15, 10], [4, 20, 12, 9], [18, 21, 11, 7]]) {
    out.rect(x, y, w, h, C.wall); out.rect(x + 1, y + 1, Math.max(1, w - 2), 1, C.wallLight);
    out.rect(x + 2, y + h - 2, Math.max(1, w - 3), 1, C.wallDark);
  }
  out.rect(0, 30, 32, 2, C.ink);
  return out;
}

function rock() {
  const out = tile(C.floor);
  out.rect(0, 0, 32, 32, C.floorDark);
  out.rect(4, 7, 24, 18, C.rockDark); out.rect(7, 4, 18, 22, C.rock);
  out.rect(10, 3, 12, 2, C.rockLight); out.rect(6, 8, 18, 2, C.rockLight);
  out.rect(8, 23, 16, 2, C.ink); out.rect(4, 13, 2, 8, C.ink); out.rect(26, 12, 2, 9, C.ink);
  out.rect(12, 12, 2, 5, C.wallLight); out.rect(19, 17, 3, 2, C.wallDark);
  return out;
}

function ore(gem, highlight) {
  const out = rock();
  out.rect(10, 11, 5, 3, gem); out.dot(11, 10, highlight); out.dot(15, 13, highlight);
  out.rect(19, 17, 5, 3, gem); out.dot(20, 16, highlight); out.dot(23, 20, highlight);
  out.dot(14, 21, gem);
  return out;
}

function stairs(up) {
  const out = caveFloor();
  out.rect(5, 4, 22, 24, C.ink); out.rect(7, 6, 18, 20, C.wood);
  for (let step = 0; step < 5; step += 1) {
    const y = up ? 21 - step * 3 : 7 + step * 3;
    out.rect(9, y, 14, 2, C.woodLight); out.rect(9, y + 2, 14, 1, C.ink);
  }
  out.rect(up ? 14 : 12, 3, 6, 3, C.glow);
  return out;
}

function caveMouth() {
  const out = caveFloor();
  out.rect(5, 9, 22, 20, C.ink); out.rect(8, 7, 16, 17, C.wallDark);
  out.rect(10, 6, 12, 2, C.wall); out.rect(8, 8, 2, 14, C.wall);
  out.rect(22, 8, 2, 14, C.wall); out.rect(10, 22, 12, 2, C.wallLight);
  out.rect(11, 10, 10, 12, C.ink); out.rect(14, 12, 4, 7, C.shadow);
  return out;
}

function exitDoor() {
  const out = caveFloor();
  out.rect(6, 7, 20, 24, C.ink); out.rect(8, 9, 16, 20, C.wood);
  out.rect(10, 10, 12, 18, C.woodLight); out.rect(11, 11, 10, 16, C.wood);
  out.rect(12, 13, 8, 12, C.ink); out.rect(13, 14, 6, 10, C.shadow);
  out.rect(18, 19, 2, 2, C.glow);
  out.rect(5, 7, 22, 3, C.wallLight);
  return out;
}

function support() {
  const out = tile(C.floor);
  out.rect(3, 6, 3, 21, C.ink); out.rect(4, 7, 2, 18, C.wood); out.rect(5, 7, 1, 17, C.woodLight);
  out.rect(26, 6, 3, 21, C.ink); out.rect(26, 7, 2, 18, C.wood); out.rect(26, 7, 1, 17, C.woodLight);
  out.rect(2, 5, 28, 4, C.ink); out.rect(3, 5, 26, 2, C.wood); out.rect(3, 5, 26, 1, C.woodLight);
  out.rect(7, 25, 18, 2, C.floorDark);
  return out;
}

function lantern() {
  const out = tile(C.floor);
  out.rect(14, 3, 4, 4, C.ink); out.rect(15, 4, 2, 3, C.woodLight);
  out.rect(10, 8, 12, 14, C.ink); out.rect(12, 10, 8, 10, C.glow);
  out.rect(13, 11, 6, 7, C.lanternGlow); out.rect(9, 22, 14, 2, C.wood);
  out.rect(14, 24, 4, 5, C.ink); out.rect(15, 24, 2, 5, C.woodLight);
  return out;
}

function elevator() {
  const out = caveFloor();
  out.rect(6, 3, 20, 26, C.ink); out.rect(8, 5, 16, 22, C.wallDark);
  out.rect(10, 7, 12, 18, C.floorDark);
  for (const y of [9, 15, 21]) out.rect(9, y, 14, 2, C.wallLight);
  out.rect(12, 4, 8, 2, C.glow); out.rect(11, 27, 10, 2, C.wood);
  return out;
}

function hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return out;
}

function pngBytes(atlas) {
  const colors = PALETTE.map((hex) => Number.parseInt(hex.slice(1), 16));
  const raw = Buffer.alloc((WIDTH * 4 + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    const rowStart = y * (WIDTH * 4 + 1); raw[rowStart] = 0;
    for (let x = 0; x < WIDTH; x += 1) {
      const i = y * WIDTH + x; const rgb = colors[atlas.pixels[i] - 1] ?? 0; const p = rowStart + 1 + x * 4;
      raw[p] = rgb >> 16; raw[p + 1] = (rgb >> 8) & 255; raw[p + 2] = rgb & 255; raw[p + 3] = atlas.alpha[i];
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(WIDTH, 0); ihdr.writeUInt32BE(HEIGHT, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const atlas = image(WIDTH, HEIGHT);
const frames = {};
function place(id, source, col, row, meta) {
  const x = col * TILE; const y = row * TILE;
  atlas.blit(source, x, y);
  frames[id] = {
    x, y, width: TILE, height: TILE,
    nativeWidth: TILE, nativeHeight: TILE, displayScale: 2, approved: false,
    pivot: { x: 16, y: 31 }, footAnchor: { x: 16, y: 31 }, footprintTiles: { width: 1, height: 1 },
    ...meta,
  };
}

const entries = [
  ['cave-floor', caveFloor(), 'ground', 'cave-floor'],
  ['cave-floor-variant', (() => { const t = caveFloor(); t.dot(18, 7, C.wallLight); t.rect(8, 18, 3, 1, C.floorDark); return t; })(), 'ground', 'cave-floor-variant'],
  ['rock-wall', caveWall(), 'object', 'stratified-rock-wall'],
  ['loose-rock', rock(), 'object', 'breakable-rock'],
  ['ore-copper', ore(C.copper, C.copperLight), 'object', 'copper-ore'],
  ['ore-silver', ore(C.silver, C.silverLight), 'object', 'silver-ore'],
  ['ore-gold', ore(C.gold, C.goldLight), 'object', 'gold-ore'],
  ['stairs-up', stairs(true), 'object', 'stairs-up'],
  ['stairs-down', stairs(false), 'object', 'stairs-down'],
  ['cave-mouth', caveMouth(), 'object', 'mine-entrance'],
  ['mine-exit-door', exitDoor(), 'object', 'forest-exit-door'],
  ['mine-support', support(), 'object', 'timber-support'],
  ['mine-lantern', lantern(), 'object', 'lantern'],
  ['mine-elevator', elevator(), 'object', 'elevator-cage'],
];
entries.forEach(([id, art, layer, role], index) => place(id, art, index % COLUMNS, Math.floor(index / COLUMNS), {
  role, kind: id === 'cave-floor' || id === 'cave-floor-variant' ? 'tile' : 'object', layer,
  surface: 'cave-stone-and-timber', tileable: id === 'cave-floor' || id === 'rock-wall',
  shadow: false, collisionFootprint: 'visual guidance only; existing MapDef rules remain authoritative',
}));

async function main() {
  const png = pngBytes(atlas);
  const generatorSha256 = hash(await readFile(fileURLToPath(import.meta.url)));
  const manifest = {
    schemaVersion: 1,
    id: 'dewhollow-p6-062-mine-candidate',
    title: 'Dewhollow Farm Pixel32 mine scene candidate',
    status: 'candidate',
    approved: false,
    source: { method: 'hand-authored integer pixel primitives; deterministic atlas generator', generator: 'generate.mjs', generatorSha256 },
    pixelContract: {
      nativeTileSize: TILE, worldTileSize: 64, displayScale: 2, sampling: 'nearest-neighbor',
      origin: 'top-left', rectConvention: 'half-open', anchorConvention: 'integer-pixel-index',
      alpha: 'RGBA; opaque tile pixels',
    },
    palette: C,
    atlas: { file: 'atlas.png', width: WIDTH, height: HEIGHT, sha256: hash(png) },
    frames,
    mapCoverage: {
      static: ['mine-entrance: wall/rock -> rock-wall or loose-rock; path -> cave-floor; cave -> cave-mouth; door -> mine-exit-door'],
      dynamic: ['mine-1..mine-N (all generated layers use cave floor, rock, ore and stairs tile kinds)'],
      oreIds: ['ore-copper', 'ore-silver', 'ore-gold'],
      note: 'Frame mapping is a candidate presentation concern; dynamic MapDef and mining rules remain authoritative.',
    },
    limitations: [
      'All frames remain unapproved candidate art; do not register them in content/assets.json or public/.',
      'Atlas provides visual samples for dynamic mine MapDef kinds; it does not alter generation, collision, ore yields, stairs or save data.',
      'Mine support, lantern and elevator frames are staging references and are not auto-placed by MapDef.',
      'Tile seams and in-game readability still require DEV preview and human review.',
    ],
  };
  await mkdir(OUT, { recursive: true });
  await writeFile(resolve(OUT, 'atlas.png'), png);
  await writeFile(resolve(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${Object.keys(frames).length} frames in ${WIDTH}x${HEIGHT}; atlas SHA-256 ${manifest.atlas.sha256}`);
}

await main();
