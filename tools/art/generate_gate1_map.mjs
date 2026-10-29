#!/usr/bin/env node
/** Reproducible hand-authored pixel32 map candidates. Writes only to the candidate directory. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/art/candidates/pixel-movement/gate1-assets/pixel32-map');
const TILE = 32;
const WIDTH = 512;
// The rows below hold additive soil edge variants. Existing frame coordinates stay fixed.
const HEIGHT = 576;
const PALETTES = {
  spring: { grass: '#82ad70', grassEdge: '#a4c77c', field: '#79563f', fieldEdge: '#a57b55', path: '#c5a678', water: '#76aeb5', drySoil: '#997350', drySoilEdge: '#b38a61', wetSoil: '#58463b', wetSoilEdge: '#755c49', woodFloor: '#a9754f', woodLight: '#c08b60', woodDark: '#81583f', accent: '#d98579', roof: '#9b6250', wall: '#e3c99b', wallDark: '#a87d50', ink: '#493d3c', leaf: '#638d5b', shadow: '#293236' },
  summer: { grass: '#76a665', grassEdge: '#98c172', field: '#785239', fieldEdge: '#a97b50', path: '#cbb47e', water: '#65a9b5', drySoil: '#94704b', drySoilEdge: '#b0895b', wetSoil: '#574439', wetSoilEdge: '#74583f', woodFloor: '#a9754f', woodLight: '#c08b60', woodDark: '#81583f', accent: '#e3ae52', roof: '#945546', wall: '#e6d09c', wallDark: '#aa8053', ink: '#493d3c', leaf: '#51834b', shadow: '#293236' },
  autumn: { grass: '#9d985d', grassEdge: '#c3b66c', field: '#80563d', fieldEdge: '#bd8955', path: '#c6a071', water: '#719ca7', drySoil: '#9c704b', drySoilEdge: '#bf8b58', wetSoil: '#60463a', wetSoilEdge: '#805a44', woodFloor: '#a9754f', woodLight: '#c08b60', woodDark: '#81583f', accent: '#d98553', roof: '#985b47', wall: '#d7b783', wallDark: '#9d754c', ink: '#493d3c', leaf: '#bd7945', shadow: '#303437' },
  winter: { grass: '#a9b9b3', grassEdge: '#d9e3d7', field: '#6b6159', fieldEdge: '#9b8e81', path: '#c7c8bd', water: '#83b4c4', drySoil: '#8c7562', drySoilEdge: '#aa9176', wetSoil: '#4d4d4a', wetSoilEdge: '#696863', woodFloor: '#a9754f', woodLight: '#c08b60', woodDark: '#81583f', accent: '#cc776e', roof: '#78858a', wall: '#d7d8c9', wallDark: '#8f8d81', ink: '#45464a', leaf: '#718b8a', shadow: '#343a3b' },
};
const SEASONS = Object.keys(PALETTES);
const COLORS = [...new Set(Object.values(PALETTES).flatMap((p) => Object.values(p)))];
const COLOR_INDEX = new Map(COLORS.map((color, index) => [color, index + 1]));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function canvas(width, height) {
  const pixels = new Uint8Array(width * height);
  const alphas = new Uint8Array(width * height).fill(255);
  return {
    width, height, pixels, alphas,
    dot(x, y, color, alpha = 255) { if (Number.isInteger(x) && Number.isInteger(y) && x >= 0 && Number.isInteger(alpha) && alpha >= 0 && alpha <= 255 && y >= 0 && x < width && y < height) { const index = y * width + x; pixels[index] = typeof color === 'number' ? color : (COLOR_INDEX.get(color) ?? 0); alphas[index] = alpha; } },
    rect(x, y, w, h, color) { for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) this.dot(px, py, color); },
  };
}

function rgbaBytes(c, colors) {
  const result = Buffer.alloc(c.pixels.length * 4);
  const rgb = colors.map((hex) => Number.parseInt(hex.slice(1), 16));
  for (let i = 0; i < c.pixels.length; i++) {
    const color = rgb[c.pixels[i] - 1];
    if (color === undefined) continue;
    result[i * 4] = color >> 16; result[i * 4 + 1] = (color >> 8) & 255; result[i * 4 + 2] = color & 255; result[i * 4 + 3] = c.alphas[i];
  }
  return result;
}

function pngChunk(type, data) {
  const crcTable = pngChunk.table ??= Uint32Array.from({ length: 256 }, (_, n) => { let v = n; for (let i = 0; i < 8; i++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1; return v >>> 0; });
  const body = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff;
  for (const byte of body) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  const out = Buffer.alloc(data.length + 12); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8); return out;
}

function storedZlib(input) {
  const chunks = [Buffer.from([0x78, 0x01])];
  for (let offset = 0; offset < input.length; offset += 65535) {
    const block = input.subarray(offset, Math.min(input.length, offset + 65535)); const header = Buffer.alloc(5);
    header[0] = offset + block.length === input.length ? 1 : 0; header.writeUInt16LE(block.length, 1); header.writeUInt16LE(block.length ^ 0xffff, 3); chunks.push(header, block);
  }
  let a = 1; let b = 0; for (const byte of input) { a = (a + byte) % 65521; b = (b + a) % 65521; }
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(((b << 16) | a) >>> 0); chunks.push(checksum); return Buffer.concat(chunks);
}

function pngBytes(c, colors) {
  const rgba = rgbaBytes(c, colors); const stride = c.width * 4; const raw = Buffer.alloc((stride + 1) * c.height);
  for (let y = 0; y < c.height; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(c.width, 0); ihdr.writeUInt32BE(c.height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const compressed = storedZlib(raw); const chunks = [Buffer.from([137,80,78,71,13,10,26,10]), pngChunk('IHDR', ihdr)];
  // Keep every chunk below bounded publication scanners' 1 MiB inspection limit.
  for (let offset = 0; offset < compressed.length; offset += 64 * 1024) {
    chunks.push(pngChunk('IDAT', compressed.subarray(offset, offset + 64 * 1024)));
  }
  chunks.push(pngChunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

function tile(base, edge = null, mask = 0) {
  const c = canvas(TILE, TILE); c.rect(0, 0, TILE, TILE, base);
  // Flat terrain blocks keep seams and foreground silhouettes readable at 1x.
  if (edge) {
    if (mask & 1) c.rect(0, 0, TILE, 4, edge);
    if (mask & 2) c.rect(28, 0, 4, TILE, edge);
    if (mask & 4) c.rect(0, 28, TILE, 4, edge);
    if (mask & 8) c.rect(0, 0, 4, TILE, edge);
  }
  return c;
}

function soilTile(base, accent, wet = false) {
  const c = tile(base);
  const marks = wet
    ? [[5, 7, 6, 2], [19, 10, 7, 2], [10, 19, 5, 2], [23, 23, 4, 2]]
    : [[5, 6, 3, 2], [19, 8, 4, 2], [10, 17, 3, 2], [24, 20, 3, 2], [16, 25, 4, 2]];
  for (const [x, y, width, height] of marks) c.rect(x, y, width, height, accent);
  return c;
}

function soilEdgeTile(base, accent, wet, sameSoilNeighborMask) {
  const c = soilTile(base, accent, wet);
  // Mask bits indicate adjacent plots with the same moisture state. Draw a crisp
  // inner edge only where that same-soil neighbor is absent.
  if (!(sameSoilNeighborMask & 1)) c.rect(0, 0, TILE, 3, accent);
  if (!(sameSoilNeighborMask & 2)) c.rect(29, 0, 3, TILE, accent);
  if (!(sameSoilNeighborMask & 4)) c.rect(0, 29, TILE, 3, accent);
  if (!(sameSoilNeighborMask & 8)) c.rect(0, 0, 3, TILE, accent);
  return c;
}

function woodFloorTile(p) {
  const c = tile(p.woodFloor);
  c.rect(0, 8, TILE, 2, p.woodDark);
  c.rect(0, 20, TILE, 2, p.woodDark);
  c.rect(4, 10, 24, 2, p.woodLight);
  c.rect(10, 22, 18, 2, p.woodLight);
  c.rect(7, 3, 2, 2, p.woodDark);
  c.rect(23, 14, 2, 2, p.woodDark);
  c.rect(5, 26, 2, 2, p.woodDark);
  return c;
}

function wallCorner(p, corner) {
  const c = canvas(TILE, TILE);
  c.rect(0, 0, TILE, 24, p.wall);
  c.rect(0, 24, TILE, 8, p.woodFloor);
  c.rect(0, 22, TILE, 2, p.wallDark);
  const left = corner.endsWith('w');
  const top = corner.startsWith('n');
  c.rect(left ? 0 : 28, 0, 4, 24, p.wallDark);
  c.rect(0, top ? 0 : 18, TILE, 4, p.wallDark);
  c.rect(left ? 4 : 24, 4, 4, 14, p.wall);
  c.rect(left ? 4 : 24, 4, 4, 2, p.woodLight);
  return c;
}

function groundShadow(p) {
  const c = canvas(TILE, 12);
  for (let y = 2; y <= 9; y += 1) {
    const normalized = (y - 5.5) / 4;
    const halfWidth = Math.round(10 * Math.sqrt(Math.max(0, 1 - normalized * normalized)));
    const alpha = Math.round(42 + 74 * Math.sqrt(Math.max(0, 1 - normalized * normalized)));
    for (let x = 16 - halfWidth; x <= 16 + halfWidth; x += 1) c.dot(x, y, p.shadow, alpha);
  }
  return c;
}

function house(p, roofOnly = false) {
  const c = canvas(96, 64);
  if (!roofOnly) {
    c.rect(4, 20, 88, 42, p.wall); c.rect(0, 15, 96, 13, p.roof); c.rect(4, 24, 88, 3, p.ink);
    c.rect(9, 34, 14, 13, p.water); c.rect(11, 36, 10, 9, p.accent); c.rect(73, 34, 14, 13, p.water); c.rect(75, 36, 10, 9, p.accent);
    c.rect(39, 38, 18, 24, p.ink); c.rect(42, 41, 12, 21, p.roof); c.rect(50, 49, 2, 2, p.accent);
  } else {
    c.rect(0, 15, 96, 13, p.roof); c.rect(4, 24, 88, 4, p.ink); c.rect(10, 26, 10, 5, p.accent); c.rect(76, 26, 10, 5, p.accent);
    c.rect(2, 19, 3, 5, p.wall); c.rect(91, 19, 3, 5, p.wall);
  }
  return c;
}

function tree(p) {
  const c = canvas(64, 64);
  c.rect(27, 35, 10, 29, p.ink); c.rect(29, 38, 6, 26, p.roof);
  c.rect(15, 15, 34, 25, p.ink); c.rect(19, 9, 26, 29, p.leaf); c.rect(10, 20, 44, 18, p.leaf);
  c.rect(17, 19, 12, 7, p.grassEdge); c.rect(34, 13, 9, 8, p.grassEdge); c.rect(14, 28, 10, 6, p.grass);
  return c;
}

function blit(target, source, x, y) { for (let py = 0; py < source.height; py++) for (let px = 0; px < source.width; px++) { const index = py * source.width + px; target.dot(x + px, y + py, source.pixels[index], source.alphas[index]); } }

async function main() {
  const atlas = canvas(WIDTH, HEIGHT); const frames = {}; let cell = 0;
  function place(key, image, extra = {}) {
    const x = extra.gridX === undefined ? (cell % 16) * TILE : extra.gridX * TILE;
    const y = extra.gridY === undefined ? Math.floor(cell / 16) * TILE : extra.gridY * TILE;
    blit(atlas, image, x, y);
    frames[key] = { x, y, width: image.width, height: image.height, nativeWidth: image.width, nativeHeight: image.height, kind: extra.kind ?? 'tile', ...extra.meta };
    if (extra.gridX === undefined) cell += 1;
  }
  for (const season of SEASONS) {
    const p = PALETTES[season];
    for (const [surface, base, accent] of [['grass', p.grass, p.grassEdge], ['field', p.field, p.fieldEdge], ['path', p.path, p.fieldEdge], ['water', p.water, p.grassEdge]]) {
      const key = `${season}-${surface}`; place(key, tile(base, accent), { meta: { season, surface, tileable: true, footAnchor: { x: 16, y: 31 }, pivot: { x: 16, y: 31 }, approved: false } });
    }
    for (const [surface, base, edge, wet] of [['dry-soil', p.drySoil, p.drySoilEdge, false], ['wet-soil', p.wetSoil, p.wetSoilEdge, true]]) {
      place(`${season}-${surface}`, soilTile(base, edge, wet), { meta: { season, surface, tileable: true, footAnchor: { x: 16, y: 31 }, pivot: { x: 16, y: 31 }, approved: false } });
    }
    for (let mask = 0; mask < 16; mask++) {
      const key = `${season}-field-edge-${mask.toString(16)}`;
      place(key, tile(p.field, p.grassEdge, mask), { meta: { season, surface: 'field', autotileMask: mask, footAnchor: { x: 16, y: 31 }, pivot: { x: 16, y: 31 }, approved: false } });
    }
  }
  const spring = PALETTES.spring;
  place('wood-floor', woodFloorTile(spring), { meta: { surface: 'wood-floor', tileable: true, footAnchor: { x: 16, y: 31 }, pivot: { x: 16, y: 31 }, approved: false } });
  for (const [index, corner] of ['nw', 'ne', 'sw', 'se'].entries()) {
    place(`wall-corner-${corner}`, wallCorner(spring, corner), { kind: 'wall-corner', meta: { surface: 'wall', corner, layer: 'back', footAnchor: { x: 16, y: 31 }, pivot: { x: 16, y: 31 }, approved: false } });
  }
  place('ground-shadow', groundShadow(spring), { kind: 'shadow', meta: { surface: 'shadow', anchor: 'bottom-center', footAnchor: { x: 16, y: 11 }, pivot: { x: 16, y: 11 }, hasTransparency: true, containsPartialAlpha: true, approved: false } });
  place('house-back', house(spring), { gridX: 0, gridY: 6, kind: 'building', meta: { widthTiles: 3, heightTiles: 2, footAnchor: { x: 48, y: 64 }, pivot: { x: 48, y: 64 }, layer: 'back', approved: false } });
  place('house-front', house(spring, true), { gridX: 0, gridY: 8, kind: 'occlusion', meta: { widthTiles: 3, heightTiles: 2, footAnchor: { x: 48, y: 64 }, pivot: { x: 48, y: 64 }, layer: 'front', approved: false } });
  place('tree-canopy', tree(spring), { gridX: 3, gridY: 6, kind: 'occlusion', meta: { widthTiles: 2, heightTiles: 2, footAnchor: { x: 32, y: 64 }, pivot: { x: 32, y: 64 }, layer: 'front', approved: false } });
  // Append mask frames in reserved rows below the original atlas content. Do not
  // shift any existing candidate frame or overlap the fixed multi-tile examples.
  let soilMaskFrame = 0;
  for (const season of SEASONS) {
    const p = PALETTES[season];
    for (const [moisture, base, accent, wet] of [['dry', p.drySoil, p.drySoilEdge, false], ['wet', p.wetSoil, p.wetSoilEdge, true]]) {
      for (let mask = 0; mask < 16; mask += 1) {
        const key = `${season}-${moisture}-soil-edge-${mask.toString(16)}`;
        place(key, soilEdgeTile(base, accent, wet, mask), {
          gridX: soilMaskFrame % 16,
          gridY: 10 + Math.floor(soilMaskFrame / 16),
          meta: {
            season,
            surface: `${moisture}-soil`,
            moisture,
            autotileMask: mask,
            maskMeaning: 'same-moisture-soil-neighbors; edge accents mark exposed sides',
            footAnchor: { x: 16, y: 31 },
            pivot: { x: 16, y: 31 },
            approved: false,
          },
        });
        soilMaskFrame += 1;
      }
    }
  }
  const atlasBytes = pngBytes(atlas, COLORS); const generatorHash = sha256(await readFile(fileURLToPath(import.meta.url)));
  await mkdir(OUT, { recursive: true }); await writeFile(resolve(OUT, 'map-atlas.png'), atlasBytes);
  const manifest = {
    schemaVersion: 1, title: 'Dewhollow pixel32 map and tileset candidate', status: 'candidate', approved: false,
    source: { method: 'hand-authored integer pixel primitives; fixed stored-DEFLATE PNG encoding', generator: 'tools/art/generate_gate1_map.mjs', generatorSha256: generatorHash },
    pixelContract: { nativeTileSize: TILE, worldTileSize: 64, displayScale: 2, sampling: 'nearest-neighbor', origin: 'top-left', rectConvention: 'half-open', anchorConvention: 'integer-pixel-index' },
    atlas: { file: 'map-atlas.png', width: WIDTH, height: HEIGHT, sha256: sha256(atlasBytes) },
    seasons: SEASONS,
    autotile: {
      surface: 'field', edgeSurface: 'grass', maskBits: { north: 1, east: 2, south: 4, west: 8 }, variantsPerSeason: 16,
      soilMaskBits: { north: 1, east: 2, south: 4, west: 8 }, soilVariantsPerSeasonAndMoisture: 16,
      soilMaskMeaning: 'A set bit means an adjacent plot shares the same moisture; accented edges mark missing same-moisture neighbors.',
    },
    frames,
    limitations: ['Candidate preview only; not approved or registered as production assets.', 'Seasonal variants and autotile masks are hand-authored visual studies, not production game map rules.', 'Building, wall-corner, shadow, and canopy frames demonstrate layer ordering and do not alter collision or map data.', 'Seam checker validates exact RGBA wrap edges for frames explicitly marked tileable; it cannot establish perceived suitability or cross-surface art quality.', 'Final colors, tile readability, seamless edges, building silhouette, and mobile readability require Gate 1 human review.'],
  };
  await writeFile(resolve(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${Object.keys(frames).length} candidate frames in ${WIDTH}x${HEIGHT}; generator SHA-256 ${generatorHash}`);
}

await main();
