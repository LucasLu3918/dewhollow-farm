import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));
const TILE = 32;
const WIDTH = 512;
const HEIGHT = 128;
const C = {
  grass: '#648A53', grassLight: '#85AB67', grassDark: '#486745',
  soil: '#876047', soilLight: '#A67D57', soilDark: '#5B3C31',
  wall: '#C79B67', wood: '#AF8258', woodDark: '#6E503E',
  roof: '#8B6459', highlight: '#F7D8A2', shadow: '#566B68', ink: '#382E2D',
  stone: '#899189', stoneLight: '#B5B29E', stoneDark: '#626A65',
  leaf: '#567849', leafLight: '#85AB67', leafDark: '#3F5D3C',
  water: '#598E9B', waterLight: '#87B9B4', waterDark: '#3D707B',
  iron: '#687A78', rust: '#A86F46', flower: '#D99A72',
};
const colors = [...new Set(Object.values(C))];
const indices = new Map(colors.map((color, index) => [color, index + 1]));

function canvas(width = TILE, height = TILE, fill = null) {
  const pixels = new Uint8Array(width * height);
  const alpha = new Uint8Array(width * height);
  const image = {
    width, height, pixels, alpha,
    dot(x, y, color, opacity = 255) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) return;
      const i = y * width + x;
      pixels[i] = indices.get(color) ?? 0;
      alpha[i] = opacity;
    },
    rect(x, y, w, h, color) {
      for (let py = y; py < y + h; py += 1) for (let px = x; px < x + w; px += 1) this.dot(px, py, color);
    },
    ellipse(cx, cy, rx, ry, color) {
      for (let y = -ry; y <= ry; y += 1) {
        const span = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
        for (let x = -span; x <= span; x += 1) this.dot(cx + x, cy + y, color);
      }
    },
    polygon(points, color) {
      const minY = Math.min(...points.map((point) => point[1]));
      const maxY = Math.max(...points.map((point) => point[1]));
      for (let y = minY; y <= maxY; y += 1) {
        const intersections = [];
        for (let i = 0; i < points.length; i += 1) {
          const [x1, y1] = points[i]; const [x2, y2] = points[(i + 1) % points.length];
          if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) intersections.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
        }
        intersections.sort((a, b) => a - b);
        for (let i = 0; i + 1 < intersections.length; i += 2) this.rect(Math.ceil(intersections[i]), y, Math.floor(intersections[i + 1]) - Math.ceil(intersections[i]) + 1, 1, color);
      }
    },
    blit(source, x, y) {
      for (let py = 0; py < source.height; py += 1) for (let px = 0; px < source.width; px += 1) {
        const from = py * source.width + px;
        if (!source.alpha[from]) continue;
        const tx = x + px; const ty = y + py;
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
        const to = ty * width + tx;
        pixels[to] = source.pixels[from]; alpha[to] = source.alpha[from];
      }
    },
  };
  if (fill) image.rect(0, 0, width, height, fill);
  return image;
}
function hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function chunk(type, data) {
  const table = chunk.crcTable ??= Uint32Array.from({ length: 256 }, (_, n) => {
    let v = n;
    for (let i = 0; i < 8; i += 1) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    return v >>> 0;
  });
  const body = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff;
  for (const byte of body) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  const out = Buffer.alloc(data.length + 12); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8); return out;
}
function png(image) {
  const rgb = colors.map((color) => Number.parseInt(color.slice(1), 16));
  const rgba = Buffer.alloc(image.width * image.height * 4);
  for (let i = 0; i < image.pixels.length; i += 1) {
    const hex = rgb[image.pixels[i] - 1];
    if (hex === undefined) continue;
    rgba[i * 4] = hex >> 16; rgba[i * 4 + 1] = (hex >> 8) & 255; rgba[i * 4 + 2] = hex & 255; rgba[i * 4 + 3] = image.alpha[i];
  }
  const stride = image.width * 4; const raw = Buffer.alloc((stride + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const blocks = [Buffer.from([0x78, 0x01])];
  for (let offset = 0; offset < raw.length; offset += 65535) {
    const data = raw.subarray(offset, Math.min(raw.length, offset + 65535)); const header = Buffer.alloc(5);
    header[0] = offset + data.length === raw.length ? 1 : 0; header.writeUInt16LE(data.length, 1); header.writeUInt16LE(data.length ^ 0xffff, 3); blocks.push(header, data);
  }
  let a = 1; let b = 0;
  for (const byte of raw) { a = (a + byte) % 65521; b = (b + a) % 65521; }
  const adler = Buffer.alloc(4); adler.writeUInt32BE(((b << 16) | a) >>> 0); blocks.push(adler);
  const compressed = Buffer.concat(blocks); const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0); ihdr.writeUInt32BE(image.height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0)),
  ]);
}
function ground(seed = 0) {
  const im = canvas(TILE, TILE, C.grass);
  for (let i = 0; i < 9; i += 1) {
    const x = 3 + ((i * 11 + seed * 7) % 25); const y = 3 + ((i * 17 + seed * 5) % 25);
    im.dot(x, y, i % 3 ? C.grassLight : C.grassDark);
  }
  return im;
}
function pathTransition(edge) {
  const im = ground(2);
  if (edge === 'horizontal') im.rect(0, 11, 32, 10, C.soil);
  if (edge === 'vertical') im.rect(11, 0, 10, 32, C.soil);
  if (edge === 'north') im.polygon([[8, 0], [24, 0], [24, 19], [21, 22], [10, 22], [8, 19]], C.soil);
  if (edge === 'south') im.polygon([[8, 13], [11, 10], [21, 10], [24, 13], [24, 32], [8, 32]], C.soil);
  if (edge === 'west') im.polygon([[0, 8], [18, 8], [22, 11], [22, 21], [18, 24], [0, 24]], C.soil);
  if (edge === 'east') im.polygon([[13, 11], [17, 8], [32, 8], [32, 24], [17, 24], [13, 21]], C.soil);
  for (const [x, y] of [[4, 4], [27, 5], [4, 27], [27, 27]]) im.dot(x, y, C.soilLight);
  return im;
}
function mailbox() {
  const im = canvas(32, 48);
  im.ellipse(16, 43, 11, 3, C.shadow);
  im.rect(15, 19, 3, 25, C.woodDark); im.rect(16, 19, 1, 23, C.wood);
  im.rect(5, 5, 22, 16, C.ink); im.rect(6, 6, 20, 13, C.rust); im.rect(7, 6, 16, 3, C.crateLight);
  im.rect(9, 11, 14, 2, C.woodDark); im.rect(10, 12, 12, 1, C.wood);
  im.rect(22, 9, 2, 6, C.iron); im.rect(21, 14, 4, 2, C.highlight);
  im.rect(13, 22, 7, 2, C.highlight); im.dot(16, 24, C.soilDark);
  return im;
}
function signpost() {
  const im = canvas(32, 48);
  im.ellipse(16, 44, 12, 3, C.shadow);
  im.rect(14, 18, 4, 26, C.woodDark); im.rect(15, 18, 2, 24, C.wood);
  im.rect(4, 5, 25, 14, C.ink); im.rect(5, 6, 23, 11, C.wood); im.rect(7, 8, 18, 1, C.highlight);
  im.polygon([[5, 12], [26, 12], [23, 15], [7, 15]], C.woodDark);
  im.rect(8, 10, 12, 2, C.wall); im.dot(21, 10, C.highlight);
  return im;
}
function well() {
  const im = canvas(64, 64);
  im.ellipse(32, 58, 26, 5, C.shadow);
  im.ellipse(32, 48, 23, 13, C.ink); im.ellipse(32, 46, 21, 12, C.stoneDark); im.ellipse(32, 44, 19, 10, C.stone);
  im.ellipse(32, 42, 13, 6, C.ink); im.ellipse(32, 42, 11, 4, C.water); im.rect(23, 40, 8, 1, C.waterLight);
  im.rect(11, 15, 5, 29, C.woodDark); im.rect(12, 16, 2, 26, C.wood);
  im.rect(48, 15, 5, 29, C.woodDark); im.rect(49, 16, 2, 26, C.wood);
  im.rect(12, 13, 41, 4, C.ink); im.rect(14, 13, 37, 2, C.roof); im.rect(16, 13, 33, 1, C.highlight);
  im.rect(29, 15, 3, 17, C.iron); im.rect(27, 28, 7, 5, C.rust); im.rect(28, 28, 4, 1, C.highlight);
  return im;
}
function trough() {
  const im = canvas(64, 32);
  im.ellipse(32, 28, 27, 3, C.shadow);
  im.rect(5, 9, 54, 14, C.ink); im.rect(7, 10, 50, 10, C.woodDark); im.rect(8, 11, 47, 7, C.water);
  im.rect(10, 11, 18, 2, C.waterLight); im.rect(8, 20, 48, 2, C.wood);
  im.rect(10, 23, 5, 4, C.woodDark); im.rect(48, 23, 5, 4, C.woodDark);
  im.rect(7, 9, 50, 2, C.highlight);
  return im;
}
function shrub(variant = 0) {
  const im = canvas(); im.ellipse(16, 28, 13, 3, C.shadow);
  const blobs = variant ? [[8, 16, 8, 8], [16, 11, 9, 10], [23, 17, 7, 7]] : [[7, 17, 8, 7], [14, 11, 9, 10], [23, 16, 8, 8]];
  for (const [x, y, rx, ry] of blobs) im.ellipse(x, y, rx, ry, C.leafDark);
  im.ellipse(14, 14, 7, 7, C.leaf); im.ellipse(20, 18, 6, 6, C.leaf);
  im.rect(10, 11, 4, 2, C.leafLight); im.rect(18, 14, 3, 2, C.leafLight);
  im.dot(24, 20, C.flower); im.dot(9, 21, C.flower);
  return im;
}
function rock() {
  const im = canvas(); im.ellipse(16, 28, 13, 3, C.shadow);
  im.polygon([[4, 23], [5, 15], [10, 10], [19, 8], [26, 13], [29, 22], [25, 27], [8, 27]], C.ink);
  im.polygon([[6, 22], [7, 16], [11, 12], [19, 10], [25, 14], [27, 22], [23, 25], [9, 25]], C.stone);
  im.rect(10, 13, 6, 2, C.stoneLight); im.rect(8, 17, 2, 3, C.stoneLight);
  im.rect(20, 20, 5, 3, C.stoneDark); im.dot(18, 13, C.highlight);
  return im;
}
function leafLitter(variant = 0) {
  const im = canvas(32, 16);
  const sprigs = variant ? [[4, 9], [12, 5], [22, 8], [27, 12]] : [[3, 11], [10, 7], [19, 10], [26, 6]];
  for (const [x, y] of sprigs) {
    im.rect(x, y, 5, 2, C.leafDark); im.dot(x + 1, y - 1, C.leafLight); im.dot(x + 4, y + 2, C.soilDark);
  }
  im.dot(15, 12, C.soilLight); im.dot(17, 11, C.rust);
  return im;
}
function rootEdge(side) {
  const im = ground(4);
  if (side === 'north' || side === 'south') {
    const y = side === 'north' ? 0 : 27;
    im.rect(0, y, 32, 5, C.soilDark); im.rect(0, y + (side === 'north' ? 4 : 0), 32, 1, C.soilLight);
    for (const x of [5, 13, 23, 29]) im.rect(x, y + (side === 'north' ? 3 : 1), 1, 4, C.woodDark);
  } else {
    const x = side === 'west' ? 0 : 27;
    im.rect(x, 0, 5, 32, C.soilDark); im.rect(x + (side === 'west' ? 4 : 0), 0, 1, 32, C.soilLight);
    for (const y of [5, 13, 23, 29]) im.rect(x + (side === 'west' ? 3 : 1), y, 4, 1, C.woodDark);
  }
  return im;
}
function fieldEdge(side) {
  const im = ground(5);
  const edge = C.soil;
  if (side === 'north') { im.rect(0, 0, 32, 9, edge); im.rect(0, 8, 32, 2, C.soilLight); }
  if (side === 'south') { im.rect(0, 23, 32, 9, edge); im.rect(0, 22, 32, 2, C.soilDark); }
  if (side === 'west') { im.rect(0, 0, 9, 32, edge); im.rect(8, 0, 2, 32, C.soilLight); }
  if (side === 'east') { im.rect(23, 0, 9, 32, edge); im.rect(22, 0, 2, 32, C.soilDark); }
  for (const [x, y] of [[4, 5], [16, 4], [24, 6], [7, 27], [20, 26]]) im.dot(x, y, side === 'north' || side === 'west' ? C.soilDark : C.soilLight);
  return im;
}
function pail() {
  const im = canvas(); im.ellipse(16, 28, 12, 3, C.shadow);
  im.polygon([[7, 10], [25, 10], [23, 26], [9, 26]], C.ink);
  im.polygon([[9, 12], [23, 12], [21, 24], [11, 24]], C.wood);
  im.rect(9, 11, 14, 2, C.highlight); im.rect(10, 16, 12, 2, C.woodDark);
  im.rect(10, 22, 12, 2, C.woodDark); im.rect(11, 13, 2, 9, C.woodMid);
  im.rect(8, 8, 16, 2, C.iron); im.rect(11, 6, 10, 1, C.iron);
  return im;
}
function basket() {
  const im = canvas(); im.ellipse(16, 28, 12, 3, C.shadow);
  im.rect(6, 13, 20, 13, C.ink); im.rect(8, 15, 16, 9, C.rust); im.rect(8, 14, 16, 2, C.highlight);
  im.rect(9, 18, 14, 2, C.woodDark); im.rect(10, 21, 12, 2, C.wood);
  im.polygon([[8, 14], [10, 7], [22, 7], [24, 14]], C.ink); im.rect(11, 9, 10, 4, C.leafDark);
  im.dot(13, 8, C.flower); im.dot(18, 7, C.rust); im.dot(20, 10, C.soilLight);
  return im;
}
function barrel() {
  const im = canvas(); im.ellipse(16, 28, 12, 3, C.shadow);
  im.ellipse(16, 8, 9, 4, C.ink); im.rect(7, 8, 18, 17, C.woodDark); im.ellipse(16, 24, 9, 4, C.woodDark);
  im.rect(9, 8, 14, 14, C.wood); im.rect(10, 8, 3, 14, C.woodMid); im.rect(19, 8, 2, 14, C.crateLight);
  im.rect(7, 10, 18, 2, C.iron); im.rect(8, 21, 16, 2, C.iron); im.ellipse(16, 8, 7, 2, C.soilDark);
  return im;
}
function boundary(style) {
  const im = ground(6);
  if (style === 'hedge') {
    im.rect(0, 12, 32, 8, C.leafDark); im.rect(2, 10, 9, 7, C.leaf); im.rect(11, 8, 10, 9, C.leafDark); im.rect(21, 10, 9, 7, C.leaf);
    im.rect(4, 10, 4, 2, C.leafLight); im.rect(14, 8, 4, 2, C.leafLight); im.rect(24, 10, 4, 2, C.leafLight);
  } else {
    im.rect(0, 13, 32, 6, C.stoneDark); im.rect(1, 11, 11, 8, C.stone); im.rect(12, 12, 9, 7, C.stoneDark); im.rect(21, 10, 10, 9, C.stone);
    im.rect(3, 11, 5, 2, C.stoneLight); im.rect(24, 10, 4, 2, C.stoneLight);
  }
  return im;
}

const atlas = canvas(WIDTH, HEIGHT);
const frames = {};
function place(id, image, col, row, meta) {
  const x = col * TILE; const y = row * TILE;
  if (x + image.width > WIDTH || y + image.height > HEIGHT) throw new Error(`Frame ${id} exceeds atlas`);
  atlas.blit(image, x, y);
  frames[id] = {
    x, y, width: image.width, height: image.height,
    nativeWidth: image.width, nativeHeight: image.height, displayScale: 2,
    approved: false, tileable: false,
    footprintTiles: { width: image.width / TILE, height: image.height / TILE },
    pivot: { x: Math.floor(image.width / 2), y: image.height - 1 },
    footAnchor: { x: Math.floor(image.width / 2), y: image.height - 1 },
    ...meta,
  };
}
function prop(id, image, col, row, layer = 'object', role = id, footprint = null) {
  place(id, image, col, row, {
    role, kind: 'prop', layer, tileable: false,
    footprintTiles: footprint ?? { width: image.width / TILE, height: image.height / TILE },
    pivot: { x: Math.floor(image.width / 2), y: image.height - 1 },
    footAnchor: { x: Math.floor(image.width / 2), y: image.height - 1 },
  });
}

// Row 0: small ground overlays and continuous path-to-grass transitions.
for (const [i, edge] of ['horizontal', 'vertical', 'north', 'south', 'west', 'east'].entries()) {
  place(`path-transition-${edge}`, pathTransition(edge), i, 0, {
    role: 'path-transition', kind: 'autotile', layer: 'ground', edgeSurface: 'grass', surface: 'path',
    direction: edge, tileable: false, footprintTiles: { width: 1, height: 1 },
    pivot: { x: 16, y: 31 }, footAnchor: { x: 16, y: 31 },
  });
}
place('leaf-litter-a', leafLitter(0), 6, 0, { role: 'leaf-litter', kind: 'overlay', layer: 'groundOverlay', tileable: false, footprintTiles: { width: 1, height: 0.5 }, pivot: { x: 16, y: 15 }, footAnchor: { x: 16, y: 15 } });
place('leaf-litter-b', leafLitter(1), 7, 0, { role: 'leaf-litter', kind: 'overlay', layer: 'groundOverlay', tileable: false, footprintTiles: { width: 1, height: 0.5 }, pivot: { x: 16, y: 15 }, footAnchor: { x: 16, y: 15 } });
place('root-edge-north', rootEdge('north'), 8, 0, { role: 'root-edge', kind: 'ground-edge', layer: 'groundOverlay', side: 'north', tileable: false, footprintTiles: { width: 1, height: 1 }, pivot: { x: 16, y: 31 }, footAnchor: { x: 16, y: 31 } });
place('root-edge-south', rootEdge('south'), 9, 0, { role: 'root-edge', kind: 'ground-edge', layer: 'groundOverlay', side: 'south', tileable: false, footprintTiles: { width: 1, height: 1 }, pivot: { x: 16, y: 31 }, footAnchor: { x: 16, y: 31 } });
for (const [i, side] of ['north', 'east', 'south', 'west'].entries()) place(`field-boundary-${side}`, fieldEdge(side), 10 + i, 0, { role: 'field-boundary', kind: 'autotile-edge', layer: 'groundOverlay', side, surface: 'dry-soil', tileable: false, footprintTiles: { width: 1, height: 1 }, pivot: { x: 16, y: 31 }, footAnchor: { x: 16, y: 31 } });

// Two-cell water point and scene props; all anchors land on their visible ground contact.
prop('mailbox', mailbox(), 0, 1, 'object', 'mailbox', { width: 1, height: 1.5 });
prop('farm-sign', signpost(), 1, 1, 'object', 'farm-sign', { width: 1, height: 1.5 });
prop('well-water-point', well(), 2, 1, 'object', 'well-water-point', { width: 2, height: 2 });
prop('water-trough', trough(), 4, 1, 'object', 'water-trough', { width: 2, height: 1 });
prop('shrub-a', shrub(0), 6, 1, 'front', 'shrub');
prop('shrub-b', shrub(1), 7, 1, 'front', 'shrub');
prop('field-rock', rock(), 8, 1, 'object', 'field-rock');
prop('watering-pail', pail(), 9, 1, 'object', 'watering-pail');
prop('harvest-basket', basket(), 10, 1, 'object', 'harvest-basket');
prop('rain-barrel', barrel(), 11, 1, 'object', 'rain-barrel');
place('field-boundary-hedge', boundary('hedge'), 12, 1, { role: 'field-boundary', kind: 'boundary', layer: 'front', surface: 'hedge', tileable: true, footprintTiles: { width: 1, height: 1 }, pivot: { x: 16, y: 31 }, footAnchor: { x: 16, y: 31 }, repeatAxis: 'horizontal' });
place('field-boundary-stone', boundary('stone'), 13, 1, { role: 'field-boundary', kind: 'boundary', layer: 'object', surface: 'stone', tileable: true, footprintTiles: { width: 1, height: 1 }, pivot: { x: 16, y: 31 }, footAnchor: { x: 16, y: 31 }, repeatAxis: 'horizontal' });

const imageBytes = png(atlas);
const manifest = {
  schemaVersion: 1,
  id: 'dewhollow-df-v2-032-farm-front-candidate',
  title: 'Dewhollow Farm Front Pixel32 Props',
  status: 'candidate', approved: false,
  source: { method: 'original code-authored integer pixel primitives; deterministic fixed coordinates', generator: 'generate.mjs' },
  pixelContract: { nativeTileSize: TILE, worldTileSize: 64, displayScale: 2, sampling: 'nearest-neighbor', origin: 'top-left', rectConvention: 'half-open', anchorConvention: 'integer-pixel-index', alpha: 'RGBA; transparent pixels reserved for object silhouette bounds' },
  palette: C,
  atlas: { file: 'atlas.png', width: WIDTH, height: HEIGHT, sha256: hash(imageBytes) },
  frames,
  limitations: [
    'All frames are unapproved candidate art and must not be registered as production content.',
    'Footprints, anchors and layers are visual suggestions only; they do not change collision, interaction, map, or save data.',
    'Path transitions and field edges require neighbor-mask mapping and rendered seam review in Phaser.',
    'The pack supplements the P2 farm slice and does not claim complete world coverage or visual acceptance.',
    'Every graphic is original code-authored pixel art; no concept screenshot or third-party source is packed into the atlas.',
  ],
};
manifest.source.generatorSha256 = hash(await readFile(fileURLToPath(import.meta.url)));
await mkdir(OUT, { recursive: true });
await writeFile(resolve(OUT, 'atlas.png'), imageBytes);
await writeFile(resolve(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${Object.keys(frames).length} frames; ${WIDTH}x${HEIGHT}; atlas SHA-256 ${manifest.atlas.sha256}`);
