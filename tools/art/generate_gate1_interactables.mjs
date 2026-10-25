#!/usr/bin/env node
/** Reproducible, hand-authored pixel32 Gate 1 interactables candidate. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_OUT = resolve(PROJECT, 'docs/art/candidates/pixel-movement/gate1-assets/pixel32-interactables');
const W = 32;
const H = 32;
const ATLAS_COLUMNS = 4;
const PALETTE = {
  ink: '#493d3c', outline: '#684b3b', woodDark: '#70452f', wood: '#9a6038', woodLight: '#c2874d',
  woodHi: '#e0ad68', metalDark: '#59656b', metal: '#8b9895', metalLight: '#d3d0bc',
  leather: '#ad7043', leaf: '#718c55', water: '#6ba7b7', waterLight: '#a0d0cf',
  cloth: '#ded0a6', seed: '#e4bb65', gold: '#e0a83c', shadow: '#302e34',
};
const COLORS = Object.values(PALETTE).map((hex) => Number.parseInt(hex.slice(1), 16));
const COLOR_INDEX = new Map(Object.keys(PALETTE).map((key, index) => [key, index + 1]));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const SOURCES = [
  { id: 'tool.hoe', path: 'public/assets/tools/hoe-2x.png', sha256: '03165e66002fbfa88fd441e4e16dd57b8e68d18dab1fa2c0631009fbb0a282a9' },
  { id: 'tool.can', path: 'public/assets/tools/can-2x.png', sha256: '36c5a163e78ee23d6554b0f8fa9a031254390a1ec84f4fe4d3de86092a10f8dd' },
  { id: 'tool.seedbag', path: 'public/assets/tools/seedbag-2x.png', sha256: '853d6e68096df186ebd975528730a9e5b8ea7c547724e40fd74bbc8ab0639ea0' },
  { id: 'tool.axe', path: 'public/assets/tools/axe-2x.png', sha256: '90f03f34c83bccae6e627a536c86e4829dd2121b9d2dbd6538266fead3266f14' },
  { id: 'tool.pick', path: 'public/assets/tools/pick-2x.png', sha256: '820e5e367cebcefe859a59a0aede6520537dd866242f8e3975afe232753d5ed7' },
  { id: 'tool.rod', path: 'public/assets/tools/rod-2x.png', sha256: '9cd6037b12bf08e95696eb6e3e10ca40029f331e1deefc8eec42721a2158a2a7' },
  { id: 'tool.sickle', path: 'public/assets/tools/sickle-2x.png', sha256: 'eca4d7932b5a5027e093ef47b4f1fc91e2f2f7f9378851ef3fcddff0424efdcc' },
  { id: 'tile.door', path: 'public/assets/tiles/door-2x.png', sha256: 'c548d4ad9423b1aebb8d5c2992f05af686e63815b8897ef430c0a12013105a42' },
  { id: 'tile.shipbox', path: 'public/assets/tiles/shipbox-2x.png', sha256: '82aa495601414f606c8bb1054ab5782186fd0bd2947533fb30d8e5076f642737' },
];

function outputDirectory(args) {
  if (args.length === 0) return DEFAULT_OUT;
  if (args.length !== 2 || args[0] !== '--out-dir' || !args[1] || args[1].startsWith('-')) {
    throw new Error('Usage: node generate_gate1_interactables.mjs [--out-dir <directory>]');
  }
  return resolve(args[1]);
}

function canvas(width, height) {
  const pixels = new Uint8Array(width * height);
  const p = {
    width, height, pixels,
    dot(x, y, color) {
      if (Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height) {
        pixels[y * width + x] = typeof color === 'number' ? color : COLOR_INDEX.get(color) ?? 0;
      }
    },
    rect(x, y, w, h, color) { for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) this.dot(xx, yy, color); },
    line(x0, y0, x1, y1, color, thickness = 1) {
      let dx = Math.abs(x1 - x0); const sx = x0 < x1 ? 1 : -1;
      let dy = -Math.abs(y1 - y0); const sy = y0 < y1 ? 1 : -1; let error = dx + dy;
      for (;;) {
        const half = Math.floor((thickness - 1) / 2); this.rect(x0 - half, y0 - half, thickness, thickness, color);
        if (x0 === x1 && y0 === y1) break;
        const twice = error * 2;
        if (twice >= dy) { error += dy; x0 += sx; }
        if (twice <= dx) { error += dx; y0 += sy; }
      }
    },
    polygon(points, color) {
      const minY = Math.min(...points.map((point) => point[1])); const maxY = Math.max(...points.map((point) => point[1]));
      for (let y = minY; y <= maxY; y += 1) {
        const crossings = [];
        for (let i = 0; i < points.length; i += 1) {
          const [x1, y1] = points[i]; const [x2, y2] = points[(i + 1) % points.length];
          if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) crossings.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
        }
        crossings.sort((a, b) => a - b);
        for (let i = 0; i + 1 < crossings.length; i += 2) this.rect(Math.ceil(crossings[i]), y, Math.floor(crossings[i + 1]) - Math.ceil(crossings[i]) + 1, 1, color);
      }
    },
  };
  return p;
}

function frameAnchor() { return { x: 16, y: 31 }; }

function drawHoe() {
  const p = canvas(W, H);
  p.line(7, 27, 24, 8, 'outline', 5); p.line(7, 26, 24, 7, 'wood', 3);
  p.line(8, 24, 21, 10, 'woodLight', 1); p.rect(5, 25, 4, 4, 'woodDark'); p.dot(6, 26, 'woodHi');
  p.line(22, 8, 27, 12, 'metalDark', 3); p.line(23, 7, 28, 11, 'metalLight', 2);
  p.polygon([[24, 8], [29, 9], [30, 13], [28, 15], [25, 12]], 'metal'); p.line(27, 10, 29, 12, 'metalLight');
  p.dot(16, 17, 'woodHi'); return { image: p, grip: { x: 7, y: 27 } };
}

function drawCan() {
  const p = canvas(W, H);
  p.line(8, 12, 11, 21, 'outline', 3); p.line(9, 12, 12, 20, 'metalLight', 1);
  p.rect(10, 15, 13, 13, 'outline'); p.rect(11, 16, 11, 11, 'metal');
  p.rect(12, 18, 8, 7, 'water'); p.rect(13, 17, 5, 2, 'waterLight');
  p.polygon([[21, 18], [28, 14], [29, 16], [23, 21]], 'outline'); p.polygon([[22, 18], [27, 15], [27, 16], [23, 20]], 'metalLight');
  p.rect(11, 26, 12, 2, 'metalDark'); p.dot(24, 15, 'waterLight');
  return { image: p, grip: { x: 10, y: 20 } };
}

function drawSeedbag() {
  const p = canvas(W, H);
  p.polygon([[10, 13], [14, 12], [14, 9], [19, 9], [19, 12], [23, 14], [25, 25], [22, 29], [10, 28], [7, 24]], 'outline');
  p.polygon([[11, 14], [14, 13], [15, 10], [18, 10], [19, 13], [22, 15], [23, 24], [21, 27], [11, 27], [9, 23]], 'cloth');
  p.rect(14, 11, 5, 2, 'leather'); p.line(14, 16, 12, 23, 'woodLight', 1); p.line(20, 16, 21, 23, 'woodLight', 1);
  p.rect(14, 14, 5, 1, 'woodHi'); p.dot(16, 9, 'seed'); p.dot(18, 8, 'seed'); p.dot(20, 10, 'seed');
  p.rect(12, 24, 8, 2, 'woodLight');
  return { image: p, grip: { x: 16, y: 13 } };
}

function drawAxe() {
  const p = canvas(W, H);
  p.line(8, 27, 22, 10, 'outline', 5); p.line(8, 26, 22, 9, 'wood', 3); p.line(9, 25, 20, 11, 'woodLight');
  p.polygon([[19, 11], [23, 5], [29, 5], [30, 7], [28, 9], [29, 12], [25, 13], [22, 11]], 'metalDark');
  p.polygon([[20, 10], [24, 6], [28, 6], [29, 7], [26, 9], [27, 11], [24, 12]], 'metalLight');
  p.dot(25, 7, 'white'); p.rect(6, 25, 4, 4, 'woodDark');
  return { image: p, grip: { x: 8, y: 27 } };
}

function drawPick() {
  const p = canvas(W, H);
  p.line(8, 27, 21, 12, 'outline', 5); p.line(8, 26, 21, 11, 'wood', 3); p.line(9, 25, 18, 14, 'woodLight');
  p.line(18, 10, 27, 8, 'metalDark', 4); p.line(20, 9, 27, 8, 'metalLight', 2);
  p.polygon([[18, 11], [20, 8], [23, 5], [25, 6], [23, 10], [21, 12]], 'metalDark');
  p.line(18, 10, 22, 6, 'metalLight', 1); p.rect(6, 25, 4, 4, 'woodDark');
  return { image: p, grip: { x: 8, y: 27 } };
}

function drawRod() {
  const p = canvas(W, H);
  p.line(9, 28, 19, 6, 'outline', 3); p.line(10, 27, 20, 6, 'wood', 1); p.line(14, 17, 20, 6, 'woodLight');
  p.rect(8, 24, 5, 5, 'outline'); p.rect(9, 25, 3, 3, 'leather'); p.dot(11, 25, 'woodHi');
  p.line(20, 6, 25, 4, 'woodDark'); p.line(24, 4, 28, 7, 'metal', 1); p.line(28, 7, 29, 13, 'outline');
  p.dot(29, 14, 'water'); p.dot(29, 13, 'waterLight');
  return { image: p, grip: { x: 10, y: 26 } };
}

function drawSickle() {
  const p = canvas(W, H);
  p.line(10, 28, 17, 21, 'outline', 5); p.line(10, 27, 17, 20, 'wood', 3); p.line(11, 26, 15, 22, 'woodLight');
  p.line(16, 20, 18, 15, 'metalDark', 3); p.line(18, 16, 22, 10, 'metalDark', 3);
  p.line(21, 11, 27, 7, 'metalDark', 2); p.line(26, 7, 29, 7, 'metalDark', 1);
  p.line(18, 16, 22, 11, 'metalLight'); p.line(22, 11, 27, 8, 'metalLight'); p.dot(11, 26, 'woodHi');
  return { image: p, grip: { x: 10, y: 27 } };
}

function drawDoor(open) {
  const p = canvas(W, H);
  // Stone-dark threshold and arched jamb echo the original farm door silhouette.
  p.rect(5, 29, 22, 2, 'shadow'); p.rect(6, 10, 2, 20, 'woodDark'); p.rect(24, 10, 2, 20, 'woodDark');
  p.line(7, 11, 9, 7, 'woodDark', 2); p.line(9, 7, 12, 5, 'woodDark', 2); p.line(12, 5, 19, 5, 'woodDark', 2);
  p.line(19, 5, 22, 7, 'woodDark', 2); p.line(22, 7, 25, 11, 'woodDark', 2); p.rect(7, 12, 17, 17, 'shadow');
  if (!open) {
    p.rect(8, 12, 16, 17, 'outline'); p.rect(9, 13, 14, 15, 'wood');
    p.rect(10, 14, 2, 13, 'woodLight'); p.rect(14, 14, 1, 13, 'woodDark'); p.rect(18, 14, 2, 13, 'woodLight');
    p.rect(9, 18, 14, 1, 'woodHi'); p.rect(9, 25, 14, 2, 'woodDark');
    p.rect(20, 19, 3, 3, 'metalDark'); p.dot(21, 20, 'gold');
  } else {
    // The dark doorway stays visible while a narrow leaf swings toward the viewer.
    p.polygon([[8, 14], [12, 12], [17, 15], [17, 28], [12, 27], [8, 29]], 'outline');
    p.polygon([[9, 15], [12, 14], [16, 16], [16, 27], [12, 26], [9, 27]], 'wood');
    p.line(10, 16, 10, 26, 'woodLight'); p.line(13, 16, 13, 26, 'woodDark');
    p.rect(14, 20, 2, 2, 'metalDark'); p.dot(15, 20, 'gold'); p.rect(17, 27, 3, 2, 'woodDark');
  }
  p.rect(5, 29, 22, 2, 'woodDark'); p.rect(6, 29, 20, 1, 'woodLight');
  return p;
}

function drawShipbox(open) {
  const p = canvas(W, H);
  p.polygon([[5, 15], [23, 12], [28, 16], [10, 20]], 'woodLight');
  if (open) {
    p.polygon([[6, 14], [9, 6], [25, 9], [28, 16], [25, 18], [9, 16]], 'outline');
    p.polygon([[8, 13], [10, 8], [23, 10], [26, 15], [24, 16], [10, 14]], 'wood');
    p.polygon([[10, 9], [11, 7], [24, 10], [25, 12], [23, 14]], 'woodLight');
    p.line(10, 9, 23, 12, 'woodHi'); p.rect(8, 15, 2, 3, 'metalDark'); p.rect(24, 16, 2, 3, 'metalDark');
  } else {
    p.polygon([[5, 15], [10, 11], [27, 14], [23, 19]], 'outline');
    p.polygon([[7, 15], [11, 13], [25, 15], [22, 17]], 'woodLight');
    p.line(9, 15, 22, 17, 'woodHi'); p.line(15, 13, 12, 17, 'wood'); p.line(21, 14, 18, 18, 'wood');
  }
  p.polygon([[5, 16], [23, 19], [23, 29], [7, 26]], 'outline');
  p.polygon([[7, 18], [21, 20], [21, 27], [8, 25]], 'wood');
  p.line(8, 18, 8, 25, 'woodLight', 2); p.line(11, 19, 11, 26, 'woodDark'); p.line(18, 20, 18, 27, 'woodLight');
  p.line(8, 22, 21, 24, 'woodHi'); p.line(7, 26, 23, 29, 'woodDark', 2);
  p.rect(14, 21, 3, 5, 'metalDark'); p.rect(15, 22, 1, 2, 'gold'); p.dot(15, 25, 'gold');
  p.rect(5, 16, 2, 10, 'metalDark'); p.rect(22, 19, 2, 9, 'metalDark');
  return p;
}

const DRAW = [
  ['tool-hoe', 'tool', 'hoe', drawHoe], ['tool-can', 'tool', 'can', drawCan], ['tool-seedbag', 'tool', 'seedbag', drawSeedbag],
  ['tool-axe', 'tool', 'axe', drawAxe], ['tool-pick', 'tool', 'pick', drawPick], ['tool-rod', 'tool', 'rod', drawRod],
  ['tool-sickle', 'tool', 'sickle', drawSickle], ['door-closed', 'door', 'closed', () => ({ image: drawDoor(false) })],
  ['door-open', 'door', 'open', () => ({ image: drawDoor(true) })], ['shipbox-closed', 'shipbox', 'closed', () => ({ image: drawShipbox(false) })],
  ['shipbox-open', 'shipbox', 'open', () => ({ image: drawShipbox(true) })],
];

function rgbaBytes(indexed) {
  const result = Buffer.alloc(indexed.pixels.length * 4);
  for (let i = 0; i < indexed.pixels.length; i += 1) {
    const rgb = COLORS[indexed.pixels[i] - 1];
    if (rgb === undefined) continue;
    result[i * 4] = rgb >> 16; result[i * 4 + 1] = (rgb >> 8) & 255; result[i * 4 + 2] = rgb & 255; result[i * 4 + 3] = 255;
  }
  return result;
}

function frameDigest(image) {
  const header = Buffer.alloc(8); header.writeUInt32BE(image.width, 0); header.writeUInt32BE(image.height, 4);
  return sha256(Buffer.concat([header, rgbaBytes(image)]));
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
    const block = input.subarray(offset, Math.min(input.length, offset + 65535)); const header = Buffer.alloc(5);
    header[0] = offset + block.length === input.length ? 1 : 0; header.writeUInt16LE(block.length, 1); header.writeUInt16LE(block.length ^ 0xffff, 3); chunks.push(header, block);
  }
  let a = 1; let b = 0; for (const byte of input) { a = (a + byte) % 65521; b = (b + a) % 65521; }
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(((b << 16) | a) >>> 0); chunks.push(checksum); return Buffer.concat(chunks);
}

function pngBytes(indexed) {
  const rgba = rgbaBytes(indexed); const stride = indexed.width * 4; const raw = Buffer.alloc((stride + 1) * indexed.height);
  for (let y = 0; y < indexed.height; y += 1) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(indexed.width, 0); ihdr.writeUInt32BE(indexed.height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const compressed = storedZlib(raw); const chunks = [Buffer.from([137,80,78,71,13,10,26,10]), pngChunk('IHDR', ihdr)];
  for (let offset = 0; offset < compressed.length; offset += 64 * 1024) chunks.push(pngChunk('IDAT', compressed.subarray(offset, offset + 64 * 1024)));
  chunks.push(pngChunk('IEND', Buffer.alloc(0))); return Buffer.concat(chunks);
}

async function main() {
  const out = outputDirectory(process.argv.slice(2));
  const atlas = canvas(ATLAS_COLUMNS * W, Math.ceil(DRAW.length / ATLAS_COLUMNS) * H); const frames = {};
  DRAW.forEach(([key, category, item, draw], index) => {
    const { image, grip } = draw(); const x = (index % ATLAS_COLUMNS) * W; const y = Math.floor(index / ATLAS_COLUMNS) * H;
    for (let py = 0; py < H; py += 1) for (let px = 0; px < W; px += 1) atlas.dot(x + px, y + py, image.pixels[py * W + px]);
    const anchor = frameAnchor();
    frames[key] = {
      x, y, width: W, height: H, nativeWidth: W, nativeHeight: H, category, item,
      state: category === 'tool' ? 'held-preview' : item,
      footAnchor: anchor, pivot: anchor, ...(grip ? { grip } : {}),
      sha256: frameDigest(image), approved: false,
    };
  });
  const atlasBytes = pngBytes(atlas); const generatorHash = sha256(await readFile(fileURLToPath(import.meta.url)));
  const manifest = {
    schemaVersion: 1, title: 'Dewhollow Pixel32 interactables candidate', status: 'candidate', approved: false,
    source: {
      method: 'hand-authored integer pixel primitives informed by existing original project assets; source images are references, not resized inputs',
      generator: 'tools/art/generate_gate1_interactables.mjs', generatorSha256: generatorHash,
      references: SOURCES,
    },
    pixelContract: { nativeTileSize: 32, sampling: 'nearest-neighbor', origin: 'top-left', rectConvention: 'half-open', anchorConvention: 'integer-pixel-index' },
    atlas: { file: 'interactables-atlas.png', width: atlas.width, height: atlas.height, sha256: sha256(atlasBytes) },
    frameLayout: { columns: ATLAS_COLUMNS, rows: Math.ceil(DRAW.length / ATLAS_COLUMNS), cellWidth: W, cellHeight: H },
    frames,
    limitations: [
      'Candidate preview only; not approved or registered as production assets.',
      'Tool grip markers support visual review only; formal tool textureSize, grip, rig, and gameplay are unchanged.',
      'Door and shipbox states illustrate visual differences only; they do not change map, collision, transport, inventory, or save behavior.',
      'Original production asset references document visual lineage and are not generator inputs.',
      'Pixel-level visual quality and device readability require human Gate 1 review.',
    ],
  };
  await mkdir(out, { recursive: true });
  await writeFile(resolve(out, 'interactables-atlas.png'), atlasBytes);
  await writeFile(resolve(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${Object.keys(frames).length} candidate frames in ${atlas.width}x${atlas.height}; generator SHA-256 ${generatorHash}`);
}

await main();
