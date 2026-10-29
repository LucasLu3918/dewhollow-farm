import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = dirname(fileURLToPath(import.meta.url));
const TILE = 32;
const ATLAS_WIDTH = 384;
const ATLAS_HEIGHT = 128;
const PALETTE = {
  ink: '#382E2D', outline: '#493936', shade: '#566B68', soil: '#876047', soilLight: '#A67D57',
  spring: '#648A53', springLight: '#85AB67', springDark: '#486745',
  summer: '#557947', summerLight: '#78A45A', summerDark: '#3F603C',
  autumn: '#A66B42', autumnLight: '#CC9851', autumnDark: '#744A38',
  winter: '#B8C7BD', winterLight: '#DFE6DA', winterDark: '#798E89',
  bark: '#80583F', barkLight: '#AF8258', blossom: '#E5A9A9', berry: '#A84E55',
  gold: '#E9C276', sky: '#84A9B0', dusk: '#9A7184', night: '#34465F', rain: '#7296A8',
  white: '#FFFFFF', springFoliage: '#5F965E', springFoliageLight: '#91C27A', springFoliageDark: '#44724D',
  summerFoliage: '#4C7D46', summerFoliageLight: '#7EAA58', summerFoliageDark: '#355E3D',
  autumnFoliage: '#A66B42', autumnFoliageLight: '#D29A50', autumnFoliageDark: '#744A38',
  winterFoliage: '#879E96', winterFoliageLight: '#C8D6CB', winterFoliageDark: '#637B77', sunset: '#E9A56C',
}
const colors = Object.values(PALETTE);
const colorIndex = new Map(colors.map((hex, index) => [hex, index + 1]));

function image(width = TILE, height = TILE) {
  return {
    width, height, pixels: new Uint8Array(width * height), alpha: new Uint8Array(width * height),
    dot(x, y, color, alpha = 255) {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const i = y * width + x;
      this.pixels[i] = typeof color === 'string' ? colorIndex.get(color) ?? 0 : color;
      this.alpha[i] = alpha;
    },
    rect(x, y, w, h, color, alpha = 255) {
      for (let py = y; py < y + h; py += 1) for (let px = x; px < x + w; px += 1) this.dot(px, py, color, alpha);
    },
    hline(x1, x2, y, color, alpha = 255) { this.rect(x1, y, x2 - x1 + 1, 1, color, alpha); },
    vline(x, y1, y2, color, alpha = 255) { this.rect(x, y1, 1, y2 - y1 + 1, color, alpha); },
    ellipse(cx, cy, rx, ry, color, alpha = 255) {
      for (let y = Math.max(0, cy - ry); y <= Math.min(height - 1, cy + ry); y += 1) {
        for (let x = Math.max(0, cx - rx); x <= Math.min(width - 1, cx + rx); x += 1) {
          const dx = (x - cx) / rx; const dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1) this.dot(x, y, color, alpha);
        }
      }
    },
    rgba() {
      const out = Buffer.alloc(this.width * this.height * 4);
      for (let i = 0; i < this.pixels.length; i += 1) {
        const color = colors[this.pixels[i] - 1] ?? '#000000';
        const p = i * 4;
        out[p] = parseInt(color.slice(1, 3), 16);
        out[p + 1] = parseInt(color.slice(3, 5), 16);
        out[p + 2] = parseInt(color.slice(5, 7), 16);
        out[p + 3] = this.alpha[i];
      }
      return out;
    },
  };
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
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6; header[10] = 0; header[11] = 0; header[12] = 0;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function canonicalHash(frame) {
  const size = Buffer.alloc(8); size.writeUInt32BE(frame.width, 0); size.writeUInt32BE(frame.height, 4);
  return createHash('sha256').update(size).update(frame.rgba()).digest('hex');
}
function ground(season, base, light, dark, accents) {
  const tile = image();
  tile.rect(0, 0, TILE, TILE, base);
  // Interior-only irregular flecks leave a shared solid-color perimeter on all four edges.
  // That gives the tile a clean seam while avoiding the repeated horizontal banding of planks.
  let seed = [...season].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 17);
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let i = 0; i < 28; i += 1) {
    const x = 2 + Math.floor(random() * 28);
    const y = 2 + Math.floor(random() * 28);
    tile.dot(x, y, i % 3 === 0 ? dark : light, i % 4 === 0 ? 160 : 220);
    if (i % 4 === 0 && x < 29 && y < 29) tile.dot(x + 1, y, i % 2 ? light : dark, 190);
  }
  for (const [x, y, color] of accents) tile.dot(x, y, color);
  if (season === 'spring') {
    for (const [x, y] of [[9, 9], [22, 24]]) { tile.dot(x, y, PALETTE.blossom); tile.dot(x + 1, y, PALETTE.gold); }
  } else if (season === 'summer') {
    for (const [x, y] of [[7, 21], [25, 10]]) tile.dot(x, y, PALETTE.gold, 210);
  } else if (season === 'autumn') {
    for (const [x, y] of [[10, 10], [22, 21], [5, 24]]) { tile.dot(x, y, PALETTE.autumnLight); tile.dot(x + 1, y, PALETTE.autumnDark); }
  } else {
    for (const [x, y] of [[14, 8], [4, 18], [26, 24]]) tile.dot(x, y, PALETTE.winterLight);
  }
  return tile;
}
function foliage(base, light, dark, flower) {
  const tile = image(96, 96);
  // 3x3-tile canopy with the same bottom-center anchor used by the existing farm tree.
  tile.ellipse(48, 85, 31, 8, PALETTE.shade, 92);
  tile.rect(42, 54, 14, 41, PALETTE.ink);
  tile.rect(45, 57, 8, 36, PALETTE.bark);
  tile.rect(47, 58, 2, 27, PALETTE.barkLight);
  for (const [x, y, rx, ry] of [[48, 36, 31, 28], [29, 44, 21, 20], [67, 44, 21, 20], [47, 21, 20, 17]]) {
    tile.ellipse(x, y, rx + 2, ry + 2, PALETTE.ink);
    tile.ellipse(x, y, rx, ry, dark);
  }
  for (const [x, y, rx, ry] of [[39, 32, 21, 18], [62, 37, 19, 16], [26, 44, 13, 12], [49, 18, 12, 9], [69, 49, 9, 7], [33, 34, 9, 6]]) {
    tile.ellipse(x, y, rx, ry, base);
  }
  for (const [x, y] of [[22, 31], [29, 24], [39, 17], [52, 14], [65, 24], [74, 34], [18, 44], [58, 47], [36, 40]]) {
    tile.rect(x, y, 5, 2, light); tile.rect(x + 1, y - 2, 2, 2, PALETTE.winterLight);
  }
  for (const [x, y] of [[33, 27], [55, 31], [44, 43], [67, 45], [25, 46]]) tile.dot(x, y, flower);
  tile.rect(10, 40, 3, 8, dark); tile.rect(82, 42, 3, 6, dark);
  return tile;
}
function overlay(kind) {
  const tile = image();
  // Every pixel has low, nonzero alpha so viewport stretching has no transparent edge or hard box.
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      if (kind === 'dawn') {
        const alpha = Math.round(14 + 18 * y / 31 + 3 * Math.sin(x * Math.PI / 31));
        tile.dot(x, y, PALETTE.gold, alpha);
      } else if (kind === 'day') {
        const alpha = Math.round(12 + 7 * (1 - Math.abs(x - 15.5) / 15.5));
        tile.dot(x, y, PALETTE.white, alpha);
      } else if (kind === 'dusk') {
        const warm = y / 31;
        const alpha = Math.round(20 + 22 * warm + 4 * Math.sin((x + y) * Math.PI / 31));
        tile.dot(x, y, warm > 0.56 ? PALETTE.sunset : PALETTE.dusk, alpha);
      } else {
        tile.dot(x, y, PALETTE.night, 54 + ((x * 3 + y * 5) % 9));
      }
    }
  }
  if (kind === 'rain-night') {
    for (let i = 0; i < 9; i += 1) {
      const x = 3 + ((i * 13 + 4) % 26); const y = 2 + ((i * 19 + 3) % 27);
      tile.vline(x, y, Math.min(y + 3, 31), PALETTE.rain, 112);
      if (i % 3 === 0) tile.dot(Math.min(x + 1, 31), Math.min(y + 4, 31), PALETTE.sky, 100);
    }
  }
  return tile;
}

const frameDefs = [
  ['season-spring', ground('spring', PALETTE.spring, PALETTE.springLight, PALETTE.springDark, [[16, 19, PALETTE.blossom]]), 'ground', true, 'seam-safe spring ground with scattered first-bloom flecks', 0, 96],
  ['season-summer', ground('summer', PALETTE.summer, PALETTE.summerLight, PALETTE.summerDark, [[18, 9, PALETTE.gold]]), 'ground', true, 'seam-safe summer ground with sunlit grass flecks', 32, 96],
  ['season-autumn', ground('autumn', PALETTE.autumn, PALETTE.autumnLight, PALETTE.autumnDark, [[17, 12, PALETTE.gold]]), 'ground', true, 'seam-safe autumn ground with fallen leaf flecks', 64, 96],
  ['season-winter', ground('winter', PALETTE.winter, PALETTE.winterLight, PALETTE.winterDark, [[16, 17, PALETTE.white]]), 'ground', true, 'seam-safe winter ground with scattered snow flecks', 96, 96],
  ['season-spring-foliage', foliage(PALETTE.springFoliage, PALETTE.springFoliageLight, PALETTE.springFoliageDark, PALETTE.blossom), 'front', false, 'spring flowering 3x3 canopy', 0, 0],
  ['season-summer-foliage', foliage(PALETTE.summerFoliage, PALETTE.summerFoliageLight, PALETTE.summerFoliageDark, PALETTE.gold), 'front', false, 'summer leafy 3x3 canopy', 96, 0],
  ['season-autumn-foliage', foliage(PALETTE.autumnFoliage, PALETTE.autumnFoliageLight, PALETTE.autumnFoliageDark, PALETTE.berry), 'front', false, 'autumn copper 3x3 canopy', 192, 0],
  ['season-winter-foliage', foliage(PALETTE.winterFoliage, PALETTE.winterFoliageLight, PALETTE.winterFoliageDark, PALETTE.white), 'front', false, 'winter snow-dusted evergreen 3x3 canopy', 288, 0],
  ['ambience-dawn', overlay('dawn'), 'effect', false, 'edge-to-edge low-alpha warm dawn viewport wash', 128, 96],
  ['ambience-day', overlay('day'), 'effect', false, 'edge-to-edge low-alpha neutral daylight viewport wash', 160, 96],
  ['ambience-dusk', overlay('dusk'), 'effect', false, 'edge-to-edge low-alpha lavender-to-amber dusk viewport wash', 192, 96],
  ['ambience-rain-night', overlay('rain-night'), 'effect', false, 'edge-to-edge low-alpha blue night viewport wash with fine rain', 224, 96],
];

const atlas = image(ATLAS_WIDTH, ATLAS_HEIGHT);
const frames = {};
for (const [id, frame, layer, tileable, description, x, y] of frameDefs) {
  for (let fy = 0; fy < frame.height; fy += 1) for (let fx = 0; fx < frame.width; fx += 1) {
    const from = fy * frame.width + fx; const to = (y + fy) * atlas.width + x + fx;
    atlas.pixels[to] = frame.pixels[from]; atlas.alpha[to] = frame.alpha[from];
  }
  const season = id.includes('spring') ? 'spring' : id.includes('summer') ? 'summer' : id.includes('autumn') ? 'autumn' : id.includes('winter') ? 'winter' : null;
  const anchor = layer === 'front' ? { x: 48, y: 95 } : layer === 'ground' ? { x: 16, y: 31 } : null;
  frames[id] = {
    x, y, width: frame.width, height: frame.height,
    nativeWidth: frame.width, nativeHeight: frame.height, displayScale: layer === 'effect' ? null : 2,
    approved: false, layer, tileable,
    role: layer === 'effect' ? 'ambience-overlay' : layer === 'front' ? 'tree-canopy' : 'seasonal-ground',
    season, composable: layer === 'effect', description,
    ...(anchor ? { anchor, pivot: anchor, footAnchor: anchor } : {}),
    ...(layer === 'effect' ? { alphaRange: { min: Math.min(...frame.alpha), max: Math.max(...frame.alpha) }, viewportFit: 'non-uniform-nearest-neighbor' } : {}),
    sha256: canonicalHash(frame),
  };
}

const png = encodePng(atlas.width, atlas.height, atlas.rgba());
const generator = await import('node:fs/promises').then(({ readFile }) => readFile(fileURLToPath(import.meta.url)));
const manifest = {
  schemaVersion: 1,
  id: 'dewhollow-p6-063-season-weather-candidate',
  title: 'Dewhollow Pixel32 four-season and ambience candidate',
  status: 'candidate', approved: false,
  source: { method: 'hand-authored integer pixel primitives with deterministic PNG encoding', generator: 'generate.mjs', generatorSha256: createHash('sha256').update(generator).digest('hex') },
  pixelContract: { nativeTileSize: TILE, worldTileSize: 64, displayScale: 2, sampling: 'nearest-neighbor', origin: 'top-left', rectConvention: 'half-open', anchorConvention: 'integer-pixel-index' },
  palette: PALETTE,
  atlas: { file: 'atlas.png', width: atlas.width, height: atlas.height, sha256: createHash('sha256').update(png).digest('hex') },
  frames,
  usage: {
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    ambience: ['dawn', 'day', 'dusk', 'rain-night'],
    composition: 'Apply seasonal ground to existing map ground tiles; map season-foliage to existing tree-canopy anchors at 3x3 tiles and keep it in the front occlusion layer. Stretch one full-frame ambience overlay across viewport bounds with Phaser setDisplaySize(viewWidth, viewHeight) and nearest-neighbor sampling; all four corners have nonzero alpha.',
  },
};
await mkdir(ROOT, { recursive: true });
await writeFile(resolve(ROOT, 'atlas.png'), png);
await writeFile(resolve(ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`generated ${frameDefs.length} frames, ${atlas.width}x${atlas.height}, sha256:${manifest.atlas.sha256}`);
