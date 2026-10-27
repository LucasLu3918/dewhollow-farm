import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const OUT = dirname(fileURLToPath(import.meta.url));
const TILE = 32;
const WIDTH = 768;
const HEIGHT = 512;
const C = {
  grass: '#648A53', grassLight: '#85AB67', grassDark: '#486745',
  soil: '#876047', soilLight: '#A67D57', soilDark: '#5B3C31',
  wall: '#C79B67', floor: '#AF8258', baseboard: '#6E503E',
  roof: '#8B6459', stone: '#899189', water: '#598E9B',
  highlight: '#F7D8A2', shadow: '#566B68', ink: '#382E2D',
  leaf: '#567849', leafLight: '#85AB67', leafDark: '#3F5D3C',
  window: '#78A8A4', windowLight: '#D7C98B', windowShadow: '#6F9B94',
  woodMid: '#B18759', roofLight: '#A87967', crate: '#A86F46', crateDark: '#704936',
  wetSoil: '#654A3D', doorDark: '#80563F', glass: '#8FB8A7', crateLight: '#BF8650',
};
const COLORS = [...new Set(Object.values(C))];
const COLOR_INDEX = new Map(COLORS.map((color, index) => [color, index + 1]));
const SEASONAL_GRASS = Object.freeze({ base: C.grass, light: C.grassLight, dark: C.grassDark });

function canvas(width, height) {
  return {
    width, height,
    pixels: new Uint16Array(width * height),
    alpha: new Uint8Array(width * height),
    dot(x, y, color, alpha = 255) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) return;
      const index = y * width + x;
      this.pixels[index] = COLOR_INDEX.get(color) ?? 0;
      this.alpha[index] = alpha;
    },
    rect(x, y, w, h, color) {
      for (let py = y; py < y + h; py += 1) for (let px = x; px < x + w; px += 1) this.dot(px, py, color);
    },
    hline(x1, x2, y, color) { this.rect(x1, y, x2 - x1 + 1, 1, color); },
    vline(x, y1, y2, color) { this.rect(x, y1, 1, y2 - y1 + 1, color); },
    polygon(points, color) {
      const ys = points.map((point) => point[1]);
      for (let y = Math.min(...ys); y <= Math.max(...ys); y += 1) {
        const intersections = [];
        for (let i = 0; i < points.length; i += 1) {
          const [x1, y1] = points[i];
          const [x2, y2] = points[(i + 1) % points.length];
          if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) intersections.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
        }
        intersections.sort((a, b) => a - b);
        for (let i = 0; i + 1 < intersections.length; i += 2) this.rect(Math.ceil(intersections[i]), y, Math.floor(intersections[i + 1]) - Math.ceil(intersections[i]) + 1, 1, color);
      }
    },
    ellipse(cx, cy, rx, ry, color, alpha = 255) {
      for (let y = -ry; y <= ry; y += 1) {
        const span = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
        for (let x = -span; x <= span; x += 1) this.dot(cx + x, cy + y, color, alpha);
      }
    },
    blit(source, x, y) {
      for (let py = 0; py < source.height; py += 1) for (let px = 0; px < source.width; px += 1) {
        const from = py * source.width + px;
        if (source.alpha[from] === 0) continue;
        const toX = x + px; const toY = y + py;
        if (toX < 0 || toY < 0 || toX >= width || toY >= height) continue;
        const to = toY * width + toX;
        this.pixels[to] = source.pixels[from]; this.alpha[to] = source.alpha[from];
      }
    },
  };
}

function hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

function rgbaBytes(image) {
  const out = Buffer.alloc(image.width * image.height * 4);
  const rgb = COLORS.map((hex) => Number.parseInt(hex.slice(1), 16));
  for (let i = 0; i < image.pixels.length; i += 1) {
    const color = rgb[image.pixels[i] - 1];
    if (color === undefined) continue;
    out[i * 4] = color >> 16; out[i * 4 + 1] = (color >> 8) & 255; out[i * 4 + 2] = color & 255; out[i * 4 + 3] = image.alpha[i];
  }
  return out;
}

function pngChunk(type, data) {
  const table = pngChunk.table ??= Uint32Array.from({ length: 256 }, (_, n) => { let v = n; for (let i = 0; i < 8; i += 1) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1; return v >>> 0; });
  const body = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff;
  for (const byte of body) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  const out = Buffer.alloc(data.length + 12); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8); return out;
}

function storedZlib(input) {
  const chunks = [Buffer.from([0x78, 0x01])];
  for (let offset = 0; offset < input.length; offset += 65535) {
    const block = input.subarray(offset, Math.min(input.length, offset + 65535)); const head = Buffer.alloc(5);
    head[0] = offset + block.length === input.length ? 1 : 0; head.writeUInt16LE(block.length, 1); head.writeUInt16LE(block.length ^ 0xffff, 3); chunks.push(head, block);
  }
  let a = 1; let b = 0;
  for (const byte of input) { a = (a + byte) % 65521; b = (b + a) % 65521; }
  const adler = Buffer.alloc(4); adler.writeUInt32BE(((b << 16) | a) >>> 0); chunks.push(adler); return Buffer.concat(chunks);
}

function pngBytes(image) {
  const rgba = rgbaBytes(image); const stride = image.width * 4; const raw = Buffer.alloc((stride + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(image.width, 0); ihdr.writeUInt32BE(image.height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const compressed = storedZlib(raw); const chunks = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr)];
  for (let offset = 0; offset < compressed.length; offset += 64 * 1024) chunks.push(pngChunk('IDAT', compressed.subarray(offset, offset + 64 * 1024)));
  chunks.push(pngChunk('IEND', Buffer.alloc(0))); return Buffer.concat(chunks);
}

function hashNoise(x, y, seed) {
  let n = Math.imul(x + seed * 31, 0x45d9f3b) ^ Math.imul(y + seed * 17, 0x119de1f3);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return (n ^ (n >>> 16)) >>> 0;
}

function grassTile(seed = 0) {
  const image = canvas(TILE, TILE); image.rect(0, 0, TILE, TILE, SEASONAL_GRASS.base);
  // Keep a one-pixel base-color border so repeated terrain is exactly seam-safe.
  for (let y = 1; y < TILE - 1; y += 1) for (let x = 1; x < TILE - 1; x += 1) {
    const n = hashNoise(x, y, seed) % 97;
    if (n === 0) image.dot(x, y, C.grassDark);
    else if (n === 1 || n === 2) image.dot(x, y, C.grassLight);
  }
  const tufts = seed % 2
    ? [[5, 7], [22, 12], [13, 23]]
    : [[8, 5], [22, 20], [4, 24]];
  for (const [x, y] of tufts) {
    image.rect(x, y, 3, 1, C.grassLight); image.dot(x + 1, y - 1, C.grassLight);
    image.dot(x + 3, y + 1, C.grassDark); image.dot(x - 1, y + 1, C.grassDark);
  }
  return image;
}

function dirtTile(base = C.soil, seed = 0, ridges = false) {
  const image = canvas(TILE, TILE); image.rect(0, 0, TILE, TILE, base);
  for (let y = 1; y < TILE - 1; y += 1) for (let x = 1; x < TILE - 1; x += 1) {
    const n = hashNoise(x, y, seed) % 83;
    if (n === 0 || n === 1) image.dot(x, y, C.soilDark);
    else if (n === 2) image.dot(x, y, C.soilLight);
  }
  if (ridges) {
    image.rect(4, 5, 24, 2, C.soilDark); image.rect(4, 7, 24, 2, C.soilLight);
    image.rect(4, 22, 24, 2, C.soilDark); image.rect(4, 24, 24, 2, C.soilLight);
    for (const x of [7, 14, 22]) image.rect(x, 10, 2, 10, C.soilDark);
  }
  return image;
}

function connectedTile(kind, mask) {
  const image = kind === 'path' ? grassTile(0) : grassTile(0);
  const fill = kind === 'path' ? C.soilLight : C.soil;
  const dark = kind === 'path' ? C.soilDark : C.soilDark;
  if (mask === 15) image.rect(0, 0, TILE, TILE, fill);
  // Center pad and arms meet at each edge, allowing matching mask neighbors to join cleanly.
  image.rect(8, 8, 16, 16, fill);
  if (mask & 1) image.rect(8, 0, 16, 16, fill);
  if (mask & 2) image.rect(16, 8, 16, 16, fill);
  if (mask & 4) image.rect(8, 16, 16, 16, fill);
  if (mask & 8) image.rect(0, 8, 16, 16, fill);
  // Hand-cut edge highlights, softened corners, and small grouped soil pixels.
  if (kind === 'field') {
    if ((mask & 1) && (mask & 8)) image.rect(0, 0, 8, 8, fill);
    if ((mask & 1) && (mask & 2)) image.rect(24, 0, 8, 8, fill);
    if ((mask & 4) && (mask & 2)) image.rect(24, 24, 8, 8, fill);
    if ((mask & 4) && (mask & 8)) image.rect(0, 24, 8, 8, fill);
  }
  for (const [x, y] of [[8, 8], [20, 10], [10, 20], [22, 21], [15, 14]]) image.dot(x, y, dark);
  if (kind === 'field') {
    for (let x = 9; x < 23; x += 1) {
      image.dot(x, 13, C.soilDark); image.dot(x, 14, C.soilLight);
      image.dot(x, 20, C.soilDark); image.dot(x, 21, C.soilLight);
    }
  } else {
    image.rect(13, 12, 6, 2, C.soil); image.rect(9, 19, 3, 1, C.soilDark); image.rect(20, 16, 3, 1, C.highlight);
  }
  return image;
}

function shadow(width = 32, height = 16) {
  const image = canvas(width, height);
  for (let y = 2; y < height - 2; y += 1) {
    const ratio = 1 - Math.pow((y - (height - 1) / 2) / ((height - 4) / 2), 2);
    const span = Math.floor((width / 2 - 3) * Math.sqrt(Math.max(0, ratio)));
    for (let x = Math.floor(width / 2) - span; x <= Math.floor(width / 2) + span; x += 1) image.dot(x, y, C.shadow, Math.round(32 + 64 * ratio));
  }
  return image;
}

function farmhouse() {
  const image = canvas(160, 96);
  // Side-wall shadow and timber body.
  image.polygon([[13, 42], [80, 8], [147, 42], [147, 84], [13, 84]], C.baseboard);
  image.polygon([[17, 43], [80, 12], [143, 43], [143, 81], [17, 81]], C.wall);
  image.rect(22, 47, 116, 2, C.highlight);
  for (let y = 53; y < 78; y += 6) image.rect(19, y, 122, 1, C.woodMid);
  for (const x of [25, 57, 103, 135]) { image.rect(x, 45, 3, 35, C.baseboard); image.rect(x, 45, 1, 34, C.highlight); }
  // Deep gable roof silhouette with layered terracotta shingles.
  image.polygon([[4, 43], [80, 2], [156, 43], [148, 51], [80, 17], [12, 51]], C.ink);
  image.polygon([[8, 41], [80, 5], [152, 41], [145, 46], [80, 14], [15, 46]], C.roof);
  image.polygon([[15, 42], [80, 14], [145, 42], [138, 47], [80, 21], [22, 47]], C.roofLight);
  for (let row = 0; row < 5; row += 1) {
    const y = 20 + row * 5; const inset = 17 - row * 2;
    image.hline(inset, 79, y, C.roof); image.hline(81, 159 - inset, y, C.roof);
    for (let x = inset + 3 + (row % 2) * 4; x < 79; x += 12) image.vline(x, y - 2, y + 1, C.baseboard);
    for (let x = 84 + (row % 2) * 4; x < 159 - inset; x += 12) image.vline(x, y - 2, y + 1, C.baseboard);
    image.hline(inset, 79, y + 1, C.highlight); image.hline(81, 159 - inset, y + 1, C.highlight);
  }
  image.vline(80, 6, 16, C.highlight);
  // Two glazed windows with warm panes and broad dark timber frames.
  for (const x of [31, 112]) {
    image.rect(x - 2, 55, 18, 18, C.ink); image.rect(x, 57, 14, 14, C.window);
    image.rect(x + 1, 58, 6, 5, C.windowLight); image.rect(x + 8, 64, 5, 6, C.windowShadow);
    image.vline(x + 7, 57, 71, C.baseboard); image.hline(x, x + 13, 64, C.baseboard);
    image.hline(x - 3, x + 16, 54, C.highlight); image.rect(x - 3, 72, 20, 3, C.baseboard);
  }
  // Door inset, framed in dark wood; warm glass slit and brass handle.
  image.rect(69, 51, 22, 33, C.ink); image.rect(72, 54, 16, 30, C.doorDark);
  image.rect(75, 57, 9, 10, C.roof); image.rect(76, 58, 7, 8, C.glass);
  image.rect(75, 70, 10, 11, C.wall); image.dot(84, 72, C.highlight); image.rect(66, 49, 28, 3, C.highlight);
  image.rect(61, 83, 38, 4, C.baseboard);
  // Porch roof shadow and supports integrated into the front-facing layer.
  image.rect(12, 43, 136, 3, C.baseboard); image.rect(15, 46, 4, 15, C.baseboard); image.rect(141, 46, 4, 15, C.baseboard);
  image.rect(16, 47, 2, 13, C.highlight); image.rect(142, 47, 2, 13, C.highlight);
  return image;
}

function porchFront() {
  const image = canvas(160, 32);
  image.rect(10, 4, 140, 4, C.baseboard); image.rect(12, 5, 136, 1, C.highlight);
  image.rect(14, 8, 4, 18, C.baseboard); image.rect(142, 8, 4, 18, C.baseboard);
  image.rect(15, 9, 2, 15, C.highlight); image.rect(143, 9, 2, 15, C.highlight);
  image.rect(8, 24, 144, 4, C.ink); image.rect(12, 25, 136, 2, C.soilLight);
  image.rect(58, 16, 44, 14, C.ink); image.rect(61, 18, 38, 9, C.baseboard);
  image.rect(64, 18, 31, 3, C.roofLight); image.hline(63, 97, 23, C.highlight);
  image.rect(73, 14, 14, 4, C.baseboard); image.rect(75, 12, 10, 3, C.wall);
  return image;
}

function treeCanopy() {
  const image = canvas(96, 96);
  image.ellipse(48, 84, 28, 8, C.shadow, 94);
  image.rect(43, 58, 12, 36, C.ink); image.rect(46, 61, 7, 32, C.baseboard); image.rect(47, 62, 2, 27, C.wall);
  for (const [x, y, rx, ry] of [[47, 37, 30, 27], [29, 43, 20, 19], [65, 44, 20, 20], [45, 23, 19, 15]]) image.ellipse(x, y, rx, ry, C.leafDark);
  for (const [x, y, rx, ry, color] of [[38, 31, 21, 18, C.leaf], [61, 37, 19, 16, C.leaf], [25, 44, 13, 12, C.leaf], [49, 18, 12, 9, C.leafLight], [68, 49, 9, 7, C.leafLight], [32, 33, 9, 6, C.leafLight]]) image.ellipse(x, y, rx, ry, color);
  // Chunked leaf highlights follow the upper-left light and break the round silhouette.
  for (const [x, y] of [[22, 31], [29, 24], [39, 17], [52, 14], [65, 24], [74, 34], [18, 44], [58, 47]]) {
    image.rect(x, y, 5, 2, C.leafLight); image.rect(x + 1, y - 2, 2, 2, C.grassLight);
  }
  image.rect(10, 40, 3, 8, C.leafDark); image.rect(82, 42, 3, 6, C.leafDark);
  return image;
}

function shippingCrate() {
  const image = canvas(32, 32);
  image.ellipse(16, 28, 12, 3, C.shadow, 90);
  image.polygon([[3, 9], [25, 7], [29, 11], [28, 27], [5, 28], [3, 24]], C.ink);
  image.polygon([[5, 10], [24, 9], [27, 12], [26, 25], [6, 26]], C.crate);
  image.rect(6, 12, 19, 3, C.crateLight); image.rect(6, 18, 19, 3, C.crateDark); image.rect(6, 22, 19, 3, C.crateLight);
  image.vline(9, 10, 25, C.highlight); image.vline(23, 10, 25, C.crateDark);
  image.rect(13, 15, 7, 2, C.baseboard); image.rect(14, 15, 5, 1, C.highlight);
  image.dot(6, 11, C.highlight); image.dot(25, 12, C.ink); image.dot(7, 24, C.ink);
  return image;
}

function stoneWall() {
  const image = canvas(32, 32); image.rect(0, 0, 32, 32, C.stoneDark);
  image.rect(1, 1, 14, 8, C.stone); image.rect(17, 1, 14, 8, C.stone);
  image.rect(3, 3, 8, 1, C.highlight); image.rect(19, 3, 9, 1, C.highlight);
  image.rect(0, 11, 7, 9, C.stone); image.rect(9, 11, 14, 9, C.stone);
  image.rect(25, 11, 7, 9, C.stone); image.rect(11, 13, 9, 1, C.highlight);
  image.rect(1, 22, 14, 9, C.stone); image.rect(17, 22, 14, 9, C.stone);
  image.rect(3, 24, 8, 1, C.highlight); image.rect(19, 24, 9, 1, C.highlight);
  image.hline(0, 31, 10, C.ink); image.hline(0, 31, 21, C.ink);
  return image;
}

function fenceTile(direction) {
  const image = canvas(32, 32); image.rect(0, 0, 32, 32, C.grass);
  const rail = (x, y, width, height) => { image.rect(x, y, width, height, C.baseboard); image.rect(x, y, width, 2, C.woodMid); image.rect(x, y, width, 1, C.highlight); };
  if (direction === 'horizontal') {
    rail(0, 10, 32, 4); rail(0, 21, 32, 4);
    for (const x of [3, 27]) { image.rect(x, 6, 3, 23, C.baseboard); image.rect(x, 7, 1, 20, C.highlight); }
  } else if (direction === 'vertical') {
    rail(9, 0, 4, 32); rail(20, 0, 4, 32);
    for (const y of [3, 26]) { image.rect(5, y, 23, 3, C.baseboard); image.rect(6, y, 21, 1, C.highlight); }
  } else {
    const [vertical, horizontal] = direction.split('-');
    if (vertical === 'north') { rail(9, 0, 4, 17); rail(20, 0, 4, 17); }
    if (vertical === 'south') { rail(9, 15, 4, 17); rail(20, 15, 4, 17); }
    if (horizontal === 'east') { rail(15, 10, 17, 4); rail(15, 21, 17, 4); }
    if (horizontal === 'west') { rail(0, 10, 17, 4); rail(0, 21, 17, 4); }
    image.rect(12, 12, 8, 8, C.baseboard); image.rect(13, 12, 6, 2, C.woodMid);
  }
  return image;
}

const atlas = canvas(WIDTH, HEIGHT);
const frames = {};
function place(id, image, col, row, meta) {
  const x = col * TILE; const y = row * TILE;
  atlas.blit(image, x, y);
  frames[id] = {
    x, y, width: image.width, height: image.height,
    nativeWidth: image.width, nativeHeight: image.height,
    displayScale: 2, approved: false, ...meta,
  };
}

place('grass-base', grassTile(0), 0, 0, { role: 'grass-base', kind: 'tile', layer: 'ground', surface: 'grass', season: 'spring', tileable: true, footprintTiles: { width: 1, height: 1 }, pivot: { x: 16, y: 31 }, footAnchor: { x: 16, y: 31 } });
place('grass-variant', grassTile(1), 1, 0, { role: 'grass-variant', kind: 'tile', layer: 'ground', surface: 'grass', season: 'spring', tileable: true, footprintTiles: { width: 1, height: 1 }, pivot: { x: 16, y: 31 }, footAnchor: { x: 16, y: 31 } });
place('path-center', connectedTile('path', 15), 2, 0, { role: 'path-center', kind: 'autotile', layer: 'ground', surface: 'path', tileable: false, autotileMask: 15, footprintTiles: { width: 1, height: 1 }, pivot: { x: 16, y: 31 }, footAnchor: { x: 16, y: 31 } });
place('path-edge', connectedTile('path', 5), 3, 0, { role: 'path-edge', kind: 'autotile', layer: 'ground', surface: 'path', tileable: false, autotileMask: 5, footprintTiles: { width: 1, height: 1 }, pivot: { x: 16, y: 31 }, footAnchor: { x: 16, y: 31 } });
place('soil-dry', dirtTile(C.soil, 2, true), 4, 0, { role: 'soil-dry', kind: 'tile', layer: 'groundOverlay', surface: 'dry-soil', tileable: true, footprintTiles: { width: 1, height: 1 }, pivot: { x: 16, y: 31 }, footAnchor: { x: 16, y: 31 } });
place('soil-wet', dirtTile(C.wetSoil, 3, true), 5, 0, { role: 'soil-wet', kind: 'tile', layer: 'groundOverlay', surface: 'wet-soil', tileable: true, footprintTiles: { width: 1, height: 1 }, pivot: { x: 16, y: 31 }, footAnchor: { x: 16, y: 31 } });
for (let mask = 0; mask < 16; mask += 1) {
  place(`path-mask-${mask.toString(16).padStart(2, '0')}`, connectedTile('path', mask), mask % 8, 1 + Math.floor(mask / 8), {
    role: 'path-mask', kind: 'autotile', layer: 'ground', surface: 'path', edgeSurface: 'grass', autotileMask: mask,
    maskBits: { north: 1, east: 2, south: 4, west: 8 }, footprintTiles: { width: 1, height: 1 }, pivot: { x: 16, y: 31 }, footAnchor: { x: 16, y: 31 }, tileable: false,
  });
  place(`field-mask-${mask.toString(16).padStart(2, '0')}`, connectedTile('field', mask), mask % 8, 3 + Math.floor(mask / 8), {
    role: 'field-mask', kind: 'autotile', layer: 'groundOverlay', surface: 'dry-soil', edgeSurface: 'grass', autotileMask: mask,
    maskBits: { north: 1, east: 2, south: 4, west: 8 }, footprintTiles: { width: 1, height: 1 }, pivot: { x: 16, y: 31 }, footAnchor: { x: 16, y: 31 }, tileable: false,
  });
}
place('farm-ground-shadow', shadow(), 0, 5, { role: 'ground-shadow', kind: 'shadow', layer: 'shadow', surface: 'shadow', anchor: 'bottom-center', tileable: false, footprintTiles: { width: 1, height: 0.5 }, pivot: { x: 16, y: 15 }, footAnchor: { x: 16, y: 15 }, hasTransparency: true, containsPartialAlpha: true });
place('house-exterior', farmhouse(), 1, 5, { role: 'house-exterior', kind: 'building', layer: 'back', surface: 'timber-and-terracotta', tileable: false, widthTiles: 5, heightTiles: 3, footprintTiles: { width: 5, height: 3 }, pivot: { x: 80, y: 95 }, footAnchor: { x: 80, y: 95 }, collisionFootprint: 'unchanged map data; art-only bounds' });
place('house-front', porchFront(), 6, 5, { role: 'house-front', kind: 'occlusion', layer: 'front', surface: 'timber', tileable: false, widthTiles: 5, heightTiles: 1, footprintTiles: { width: 5, height: 1 }, pivot: { x: 80, y: 31 }, footAnchor: { x: 80, y: 31 }, occludesActors: true });
place('tree-canopy', treeCanopy(), 11, 5, { role: 'tree-canopy', kind: 'occlusion', layer: 'front', surface: 'leaf-and-bark', tileable: false, widthTiles: 3, heightTiles: 3, footprintTiles: { width: 3, height: 3 }, pivot: { x: 48, y: 95 }, footAnchor: { x: 48, y: 95 }, occludesActors: true });
place('shipping-crate', shippingCrate(), 14, 5, { role: 'shipping-crate', kind: 'object', layer: 'object', surface: 'wood', tileable: false, widthTiles: 1, heightTiles: 1, footprintTiles: { width: 1, height: 1 }, pivot: { x: 16, y: 27 }, footAnchor: { x: 16, y: 27 }, collisionFootprint: 'existing shipping-box target; art-only bounds' });
place('stone-wall', stoneWall(), 15, 5, { role: 'stone-wall', kind: 'wall', layer: 'object', surface: 'mossy-stone', tileable: true, footprintTiles: { width: 1, height: 1 }, pivot: { x: 16, y: 31 }, footAnchor: { x: 16, y: 31 } });
for (const [index, direction] of ['horizontal', 'vertical', 'north-east', 'north-west', 'south-east', 'south-west'].entries()) {
  place(`fence-${direction}`, fenceTile(direction), 16 + index, 5, { role: 'fence', kind: 'wall', layer: 'object', surface: 'painted-wood', direction, tileable: true, footprintTiles: { width: 1, height: 1 }, pivot: { x: 16, y: 31 }, footAnchor: { x: 16, y: 31 } });
}

async function main() {
  const png = pngBytes(atlas);
  const generatorSha256 = hash(await readFile(fileURLToPath(import.meta.url)));
  const manifest = {
    schemaVersion: 1,
    id: 'dewhollow-world-v2-farm-candidate',
    title: 'Dewhollow Farm Pixel32 scene slice',
    status: 'candidate',
    approved: false,
    source: {
      method: 'hand-authored integer pixel primitives with deterministic seeded clusters',
      generator: 'generate.mjs',
      generatorSha256,
    },
    pixelContract: {
      nativeTileSize: TILE, worldTileSize: 64, displayScale: 2, sampling: 'nearest-neighbor',
      origin: 'top-left', rectConvention: 'half-open', anchorConvention: 'integer-pixel-index',
      alpha: 'RGBA; zero alpha only outside shadow/occlusion/object bounds',
    },
    palette: C,
    atlas: { file: 'atlas.png', width: WIDTH, height: HEIGHT, sha256: hash(png) },
    autotile: { maskBits: { north: 1, east: 2, south: 4, west: 8 }, variantsPerFamily: 16 },
    frames,
    recommendedSceneGrammar: ['ground', 'groundOverlay', 'shadow', 'back', 'object', 'runtimeActor', 'front'],
    limitations: [
      'All frames are unapproved candidate art; never register in content/assets.json or public/.',
      'Collision, interaction targets, spawn points, and map data stay unchanged; footprint metadata is visual guidance only.',
      'Farm path and field masks are candidate geometry that requires Phaser neighbor-mask mapping and a human seam review.',
      'This atlas is a compact farm visual slice, not full seasonal coverage or a production-quality complete world pack.',
      'The atlas is made from original code-authored pixel shapes; no generated concept image is packed into it.',
    ],
  };
  await mkdir(OUT, { recursive: true });
  await writeFile(resolve(OUT, 'atlas.png'), png);
  await writeFile(resolve(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${Object.keys(frames).length} frames in ${WIDTH}x${HEIGHT}; atlas SHA-256 ${manifest.atlas.sha256}`);
}

await main();
