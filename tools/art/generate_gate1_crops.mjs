#!/usr/bin/env node
/** Reproducibly draw isolated Pixel32 Gate 1 crop growth-stage candidates. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_OUT = join(ROOT, 'docs/art/candidates/pixel-movement/gate1-assets/pixel32-crops');
const SOURCE_FILE = 'public/assets/crops/sweet-radish-2x.png';
const SOURCE_SHA256 = 'e7cb6a3631de28f28cda03e9ced2725a1bf30c6f8634975e0a53964f47e8fbe7';
const ATLAS_FILE = 'sweet-radish-stages.png';
const COLORS = {
  rootOutline: '#702b3c', rootShadow: '#ac3449', rootMid: '#d94752', rootLight: '#f16a68', rootGlint: '#ff9a83',
  leafDeep: '#285b3e', leafShadow: '#347346', leafMid: '#4d9657', leafLight: '#79bd67', leafGlint: '#b3dc78',
  seedLight: '#f3bd83', seedShade: '#8a4a45',
  grassDeep: '#315f3d', grassMid: '#5f9b51', grassLight: '#a5cb65', grassFlower: '#f5e7a0',
  beanDeep: '#385e3f', beanMid: '#57935a', beanLight: '#8fc875', beanPod: '#6ea64d', beanSeed: '#e6c878',
};
const CROPS = [
  { id: 'dew-grass', title: '晨露草', y: 32, draws: { seed: drawGrassSeed, sprout: drawGrassSprout, 'growing-1': drawGrassGrowing1, 'growing-2': drawGrassGrowing2, flowering: drawGrassFlowering, mature: drawGrassMature } },
  { id: 'moon-bean', title: '月光豆', y: 64, draws: { seed: drawBeanSeed, sprout: drawBeanSprout, 'growing-1': drawBeanGrowing1, 'growing-2': drawBeanGrowing2, flowering: drawBeanFlowering, mature: drawBeanMature } },
  { id: 'sweet-radish', title: '甜蘿蔔', y: 0, draws: { seed: drawSeed, sprout: drawSprout, 'growing-1': drawRadishGrowing1, 'growing-2': drawRadishGrowing2, flowering: drawRadishFlowering, mature: drawMature } },
];
const STAGES = ['seed', 'sprout', 'growing-1', 'growing-2', 'flowering', 'mature'];
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const payload = Buffer.concat([name, data]);
  const output = Buffer.alloc(payload.length + 8);
  output.writeUInt32BE(data.length, 0); payload.copy(output, 4); output.writeUInt32BE(crc32(payload), payload.length + 4);
  return output;
}
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6; header[10] = 0; header[11] = 0; header[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    chunk('IDAT', deflateStored(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Use RFC 1950/1951 stored blocks so PNG bytes do not depend on zlib versions. */
function deflateStored(input) {
  const blocks = [Buffer.from([0x78, 0x01])];
  let offset = 0;
  do {
    const length = Math.min(0xffff, input.length - offset);
    const final = offset + length === input.length;
    const block = Buffer.alloc(5 + length);
    block[0] = final ? 1 : 0;
    block.writeUInt16LE(length, 1);
    block.writeUInt16LE(~length & 0xffff, 3);
    input.copy(block, 5, offset, offset + length);
    blocks.push(block);
    offset += length;
  } while (offset < input.length);

  let s1 = 1; let s2 = 0;
  for (const byte of input) {
    s1 = (s1 + byte) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE(((s2 << 16) | s1) >>> 0);
  blocks.push(adler);
  return Buffer.concat(blocks);
}

function canvas() {
  const rgba = Buffer.alloc(32 * 32 * 4);
  const colorBytes = Object.fromEntries(Object.entries(COLORS).map(([key, hex]) => [key, Buffer.from([
    Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16), 255,
  ])]));
  const pixel = (x, y, color) => {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= 32 || y >= 32) return;
    colorBytes[color].copy(rgba, (y * 32 + x) * 4);
  };
  const rect = (x, y, width, height, color) => {
    for (let yy = y; yy < y + height; yy += 1) for (let xx = x; xx < x + width; xx += 1) pixel(xx, yy, color);
  };
  const ellipse = (cx, cy, rx, ry, color) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        const dx = (x - cx) / rx; const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) pixel(x, y, color);
      }
    }
  };
  const line = (x1, y1, x2, y2, color) => {
    const dx = Math.abs(x2 - x1); const sx = x1 < x2 ? 1 : -1;
    const dy = -Math.abs(y2 - y1); const sy = y1 < y2 ? 1 : -1;
    let error = dx + dy;
    while (true) {
      pixel(x1, y1, color);
      if (x1 === x2 && y1 === y2) break;
      const twice = 2 * error;
      if (twice >= dy) { error += dy; x1 += sx; }
      if (twice <= dx) { error += dx; y1 += sy; }
    }
  };
  return { rgba, pixel, rect, ellipse, line };
}

function drawSeed() {
  const c = canvas();
  c.ellipse(16, 26, 4, 3, 'rootOutline'); c.ellipse(16, 25, 3, 2, 'rootMid');
  c.pixel(15, 24, 'rootLight'); c.pixel(17, 27, 'rootShadow'); c.line(16, 28, 16, 30, 'rootShadow');
  c.pixel(15, 30, 'rootOutline'); c.pixel(13, 24, 'seedShade'); c.pixel(14, 23, 'seedLight');
  return c;
}
function drawSprout() {
  const c = canvas();
  c.line(16, 29, 16, 19, 'leafDeep');
  c.line(16, 22, 10, 17, 'leafShadow'); c.line(16, 21, 11, 16, 'leafMid');
  c.line(16, 19, 22, 14, 'leafDeep'); c.line(16, 20, 22, 13, 'leafMid');
  c.ellipse(9, 16, 3, 2, 'leafMid'); c.pixel(8, 15, 'leafLight'); c.pixel(10, 17, 'leafShadow');
  c.ellipse(23, 13, 3, 2, 'leafLight'); c.pixel(24, 12, 'leafGlint'); c.pixel(22, 14, 'leafShadow');
  c.ellipse(16, 28, 3, 2, 'rootOutline'); c.ellipse(16, 27, 2, 2, 'rootMid');
  c.pixel(15, 26, 'rootLight'); c.line(16, 29, 16, 31, 'rootShadow');
  return c;
}
function drawMature() {
  const c = canvas();
  // Broad red-pink leaf crown and upright stems, with the bulb meeting the ground anchor.
  c.line(16, 20, 8, 8, 'leafDeep'); c.line(16, 19, 24, 6, 'leafDeep');
  c.line(16, 19, 5, 13, 'leafShadow'); c.line(16, 19, 27, 12, 'leafShadow');
  c.line(16, 20, 12, 4, 'leafDeep'); c.line(16, 20, 20, 3, 'leafDeep');
  c.ellipse(7, 10, 5, 3, 'leafShadow'); c.ellipse(8, 9, 4, 2, 'leafMid');
  c.ellipse(25, 8, 5, 3, 'leafDeep'); c.ellipse(24, 7, 4, 2, 'leafLight');
  c.ellipse(4, 14, 4, 3, 'leafMid'); c.ellipse(28, 13, 4, 3, 'leafShadow');
  c.ellipse(12, 5, 4, 3, 'leafMid'); c.ellipse(20, 5, 4, 3, 'leafShadow');
  c.pixel(6, 8, 'leafGlint'); c.pixel(25, 6, 'leafGlint'); c.pixel(11, 4, 'leafLight'); c.pixel(19, 4, 'leafLight');
  c.ellipse(16, 22, 8, 8, 'rootOutline');
  c.ellipse(16, 21, 7, 7, 'rootMid'); c.ellipse(15, 20, 5, 5, 'rootLight');
  c.ellipse(13, 19, 2, 3, 'rootGlint'); c.ellipse(21, 23, 2, 4, 'rootShadow');
  c.line(16, 28, 16, 31, 'rootShadow'); c.pixel(15, 31, 'rootOutline'); c.pixel(17, 30, 'rootMid');
  c.pixel(8, 19, 'rootShadow'); c.pixel(23, 18, 'rootLight');
  return c;
}

// Sweet-radish intermediate milestones retain the original three legacy cells above.
function drawRadishGrowing1() { const c = drawSprout(); c.ellipse(16, 26, 4, 3, 'rootMid'); c.line(16, 25, 16, 31, 'rootShadow'); return c; }
function drawRadishGrowing2() { const c = drawMature(); c.ellipse(16, 24, 6, 6, 'rootMid'); c.ellipse(15, 22, 4, 4, 'rootLight'); return c; }
function drawRadishFlowering() { const c = drawMature(); c.line(16, 8, 16, 3, 'seedShade'); c.ellipse(16, 3, 2, 2, 'seedLight'); c.pixel(13, 3, 'rootGlint'); c.pixel(19, 3, 'rootGlint'); return c; }

function grassBase(blades, flower = false) {
  const c = canvas();
  c.rect(13, 28, 6, 2, 'grassDeep'); c.rect(12, 30, 8, 1, 'grassDeep');
  for (const [x, tip, bend] of blades) {
    c.line(16, 28, bend, tip + 3, 'grassDeep');
    c.line(16, 28, x, tip + 2, 'grassMid');
    c.pixel(x, tip, 'grassLight');
  }
  if (flower) {
    for (const [x, y] of [[10, 6], [22, 9], [16, 3]]) {
      c.pixel(x, y, 'grassFlower'); c.pixel(x - 1, y + 1, 'grassLight'); c.pixel(x + 1, y + 1, 'grassFlower');
    }
  }
  return c;
}
function drawGrassSeed() { const c = canvas(); c.ellipse(16, 27, 3, 2, 'grassDeep'); c.pixel(15, 26, 'grassLight'); return c; }
function drawGrassSprout() { return grassBase([[16, 20, 15], [12, 23, 14]], false); }
function drawGrassGrowing1() { return grassBase([[16, 17, 16], [11, 21, 14], [21, 20, 18]], false); }
function drawGrassGrowing2() { return grassBase([[16, 13, 16], [10, 18, 13], [22, 17, 19], [13, 19, 14]], false); }
function drawGrassFlowering() { return grassBase([[16, 11, 16], [9, 16, 13], [23, 15, 19], [12, 18, 14], [20, 18, 18]], true); }
function drawGrassMature() { return grassBase([[16, 10, 16], [8, 14, 12], [24, 13, 20], [11, 17, 13], [21, 16, 19], [14, 19, 15]], true); }

function beanVine(height, pods = 0, flowers = false) {
  const c = canvas();
  c.line(16, 30, 15, 24, 'beanDeep'); c.line(15, 24, 17, 17, 'beanMid'); c.line(17, 17, 15, height, 'beanDeep');
  c.line(15, 23, 9, 20, 'beanDeep'); c.ellipse(8, 19, 3, 2, 'beanMid'); c.pixel(7, 18, 'beanLight');
  c.line(16, 19, 22, 15, 'beanDeep'); c.ellipse(23, 14, 3, 2, 'beanMid'); c.pixel(24, 13, 'beanLight');
  if (height < 20) { c.ellipse(15, 26, 2, 2, 'beanSeed'); }
  if (pods > 0) {
    c.line(17, 17, 22, 20, 'beanDeep'); c.line(22, 20, 23, 26, 'beanPod'); c.line(23, 26, 20, 29, 'beanMid');
    c.pixel(22, 23, 'beanLight'); if (pods > 1) { c.line(15, 21, 10, 23, 'beanDeep'); c.line(10, 23, 9, 28, 'beanPod'); }
  }
  if (flowers) { c.pixel(15, height, 'grassFlower'); c.pixel(14, height + 1, 'grassFlower'); c.pixel(16, height + 1, 'beanSeed'); }
  return c;
}
function drawBeanSeed() { const c = canvas(); c.ellipse(16, 27, 4, 3, 'beanDeep'); c.ellipse(16, 26, 3, 2, 'beanSeed'); c.pixel(15, 25, 'grassFlower'); return c; }
function drawBeanSprout() { return beanVine(20); }
function drawBeanGrowing1() { return beanVine(15); }
function drawBeanGrowing2() { return beanVine(10, 1); }
function drawBeanFlowering() { return beanVine(7, 1, true); }
function drawBeanMature() { return beanVine(6, 2, true); }

function frameDigest(rgba) {
  const canonical = Buffer.alloc(8 + rgba.length);
  canonical.writeUInt32BE(32, 0); canonical.writeUInt32BE(32, 4); rgba.copy(canonical, 8);
  return sha256(canonical);
}
function buildManifest(generatorSha256, atlasSha256, frameSpecs) {
  return {
    schemaVersion: 1,
    id: 'gate1-pixel32-content-first-crop-growth-stages',
    title: '內容優先 Pixel32 作物六階候選',
    assetKey: 'crop.content-first-three',
    status: 'candidate',
    approved: false,
    source: {
      method: '以 generator 中原創整數像素圖元手工繪製三種作物；甜蘿蔔參考圖只供紅色塊根與綠葉特徵，不取樣、不縮放、不複製像素。',
      generator: 'tools/art/generate_gate1_crops.mjs',
      generatorSha256,
      reference: { file: SOURCE_FILE, sha256: SOURCE_SHA256, role: 'feature-reference-only; source pixels are not reused' },
      crops: CROPS.map(({ id }) => ({ id, method: 'original hand-authored integer-pixel primitives; no external pixels sampled' })),
    },
    pixelContract: {
      nativeTileSize: 32, worldTileSize: 64, displayScale: 2, sampling: 'nearest-neighbor',
      origin: 'top-left', rectConvention: 'half-open', anchorConvention: 'integer-pixel-index',
    },
    atlas: { file: ATLAS_FILE, width: 192, height: 96, colorType: 'RGBA8888', sha256: atlasSha256 },
    palette: COLORS,
    crops: CROPS.map(({ id, title }) => ({ id, title, assetKey: `crop.${id}`, frameKeys: STAGES.map((stage) => `crop.${id}.${stage}`) })),
    frames: frameSpecs,
    limitations: [
      'Candidate only: this exact version is not reviewed, approved, integrated, or registered in production assets.',
      'The existing sweet-radish PNG is a feature reference only; candidate pixels are hand-authored in the bound generator.',
      'The checker verifies structure and reproducibility, not visual quality, in-game readability, device display, or Gate 1 acceptance.',
      'Legacy sweet-radish seed/sprout/mature aliases remain for compatibility; canonical frames use crop.<cropId>.<stage>.',
    ],
  };
}

async function generate(out) {
  const sourcePath = join(ROOT, SOURCE_FILE);
  const sourceDigest = sha256(await readFile(sourcePath));
  if (sourceDigest !== SOURCE_SHA256) throw new Error(`source feature reference digest changed: ${SOURCE_FILE}`);
  const generatorSha256 = sha256(await readFile(fileURLToPath(import.meta.url)));
  const atlasPixels = Buffer.alloc(192 * 96 * 4);
  const frames = {};
  for (const crop of CROPS) for (let index = 0; index < STAGES.length; index += 1) {
    const stage = STAGES[index]; const sprite = crop.draws[stage](); const x = index * 32; const y = crop.y;
    for (let row = 0; row < 32; row += 1) sprite.rgba.copy(atlasPixels, ((y + row) * 192 + x) * 4, row * 32 * 4, (row + 1) * 32 * 4);
    const id = `crop.${crop.id}.${stage}`;
    frames[id] = {
      x, y, width: 32, height: 32, nativeWidth: 32, nativeHeight: 32,
      footAnchor: { x: 16, y: 31 }, pivot: { x: 16, y: 31 },
      kind: 'cropOverlay', stage, tags: ['crop', crop.id, stage, 'candidate'], sha256: frameDigest(sprite.rgba),
    };
  }
  for (const stage of ['seed', 'sprout', 'mature']) frames[stage] = { ...frames[`crop.sweet-radish.${stage}`] };
  const atlasBytes = encodePng(192, 96, atlasPixels);
  const manifest = buildManifest(generatorSha256, sha256(atlasBytes), frames);
  await mkdir(out, { recursive: true });
  await writeFile(join(out, ATLAS_FILE), atlasBytes);
  await writeFile(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

function parseArgs(args) {
  let output = DEFAULT_OUT;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--output' && args[index + 1]) {
      output = isAbsolute(args[index + 1]) ? args[index + 1] : resolve(args[index + 1]);
      index += 1;
    } else throw new Error(`unsupported option: ${args[index]}`);
  }
  return output;
}

try {
  const output = parseArgs(process.argv.slice(2));
  await generate(output);
  process.stdout.write(`Generated candidate atlas and manifest in ${output}\n`);
} catch (error) {
  process.stderr.write(`FAIL: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
