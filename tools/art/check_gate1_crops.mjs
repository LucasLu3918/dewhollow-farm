#!/usr/bin/env node
/** Fail-closed validator for the isolated Pixel32 content-first crop candidates. */
import { createHash } from 'node:crypto';
import { mkdtemp, open, readFile, rm, lstat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { inflateSync } from 'node:zlib';
import { constants } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_MANIFEST = join(ROOT, 'docs/art/candidates/pixel-movement/gate1-assets/pixel32-crops/manifest.json');
const GENERATOR = join(ROOT, 'tools/art/generate_gate1_crops.mjs');
const REFERENCE = {
  file: 'public/assets/crops/sweet-radish-2x.png',
  sha256: 'e7cb6a3631de28f28cda03e9ced2725a1bf30c6f8634975e0a53964f47e8fbe7',
};
const COLORS = {
  rootOutline: '#702b3c', rootShadow: '#ac3449', rootMid: '#d94752', rootLight: '#f16a68', rootGlint: '#ff9a83',
  leafDeep: '#285b3e', leafShadow: '#347346', leafMid: '#4d9657', leafLight: '#79bd67', leafGlint: '#b3dc78',
  seedLight: '#f3bd83', seedShade: '#8a4a45',
  grassDeep: '#315f3d', grassMid: '#5f9b51', grassLight: '#a5cb65', grassFlower: '#f5e7a0',
  beanDeep: '#385e3f', beanMid: '#57935a', beanLight: '#8fc875', beanPod: '#6ea64d', beanSeed: '#e6c878',
};
const ROOT_COLORS = [COLORS.rootOutline, COLORS.rootShadow, COLORS.rootMid, COLORS.rootLight, COLORS.rootGlint].map(toRgbaKey);
const LEAF_COLORS = [COLORS.leafDeep, COLORS.leafShadow, COLORS.leafMid, COLORS.leafLight, COLORS.leafGlint].map(toRgbaKey);
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_GENERATOR_BYTES = 256 * 1024;
const MAX_ATLAS_BYTES = 128 * 1024;
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});

function toRgbaKey(hex) {
  return `${hex.slice(1).toLowerCase()}ff`;
}
function fail(message) { throw new Error(message); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value, expected, label) {
  if (!isRecord(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort(); const wanted = [...expected].sort();
  const missing = wanted.filter((key) => !(key in value));
  const extra = actual.filter((key) => !wanted.includes(key));
  if (missing.length || extra.length) fail(`${label} fields invalid; missing=${missing.join(',')} extra=${extra.join(',')}`);
}
function integer(value) { return Number.isSafeInteger(value); }
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function readRegular(path, label, maxBytes) {
  let fd;
  try {
    const linkInfo = await lstat(path);
    if (linkInfo.isSymbolicLink()) fail(`${label} must not be a symbolic link`);
    fd = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const info = await fd.stat();
    if (!info.isFile()) fail(`${label} is not a regular file`);
    if (info.size > maxBytes) fail(`${label} exceeds the ${maxBytes}-byte file limit`);
    return await fd.readFile();
  } catch (error) {
    if (error instanceof Error && error.message.includes('FAIL:')) throw error;
    fail(`${label} cannot be read: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await fd?.close();
  }
}

function decodeRgbaPng(bytes, label) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) fail(`${label} is not a PNG`);
  let offset = 8; let header = null; let ended = false; const compressed = []; let chunks = 0;
  while (offset + 12 <= bytes.length) {
    chunks += 1;
    if (chunks > 32) fail(`${label} contains too many PNG chunks`);
    const length = bytes.readUInt32BE(offset); const end = offset + length + 12;
    if (end > bytes.length) fail(`${label} has a truncated PNG chunk`);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== bytes.readUInt32BE(offset + 8 + length)) fail(`${label} has invalid ${type} chunk CRC`);
    if (type === 'IHDR') {
      if (header || length !== 13) fail(`${label} has invalid IHDR`);
      header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9], compression: data[10], filter: data[11], interlace: data[12] };
    } else if (type === 'IDAT') compressed.push(data);
    else if (type === 'IEND') {
      if (length !== 0) fail(`${label} has invalid IEND`);
      ended = true; offset = end; break;
    } else fail(`${label} contains unsupported ${type} chunk`);
    offset = end;
  }
  if (!header || !ended || offset !== bytes.length) fail(`${label} has an incomplete PNG chunk sequence`);
  if (header.width !== 192 || header.height !== 96) fail(`${label} dimensions must be 192x96`);
  if (header.bitDepth !== 8 || header.colorType !== 6 || header.compression !== 0 || header.filter !== 0 || header.interlace !== 0) fail(`${label} must be non-interlaced 8-bit RGBA PNG`);
  const stride = header.width * 4; const expectedLength = (stride + 1) * header.height;
  const inflated = inflateSync(Buffer.concat(compressed), { maxOutputLength: expectedLength });
  if (inflated.length !== expectedLength) fail(`${label} has an invalid decompressed pixel length`);
  const pixels = Buffer.alloc(stride * header.height);
  for (let y = 0; y < header.height; y += 1) {
    if (inflated[y * (stride + 1)] !== 0) fail(`${label} uses unsupported PNG filter`);
    inflated.copy(pixels, y * stride + 0, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
  }
  return { width: header.width, height: header.height, pixels };
}

function digestFrame(image, frame) {
  const canonical = Buffer.alloc(8 + frame.width * frame.height * 4);
  canonical.writeUInt32BE(frame.width, 0); canonical.writeUInt32BE(frame.height, 4);
  let offset = 8;
  for (let y = frame.y; y < frame.y + frame.height; y += 1) {
    const start = (y * image.width + frame.x) * 4;
    image.pixels.copy(canonical, offset, start, start + frame.width * 4); offset += frame.width * 4;
  }
  return sha256(canonical);
}
function colorCounts(image, frame) {
  const counts = new Map();
  for (let y = frame.y; y < frame.y + frame.height; y += 1) {
    for (let x = frame.x; x < frame.x + frame.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      const key = image.pixels.subarray(offset, offset + 4).toString('hex');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

async function check(manifestPath) {
  const directory = dirname(manifestPath);
  const manifestBytes = await readRegular(manifestPath, 'manifest.json', MAX_MANIFEST_BYTES);
  let manifest;
  try { manifest = JSON.parse(manifestBytes.toString('utf8')); } catch (error) { fail(`manifest.json is invalid JSON: ${error instanceof Error ? error.message : String(error)}`); }
  exactKeys(manifest, ['schemaVersion', 'id', 'title', 'assetKey', 'status', 'approved', 'source', 'pixelContract', 'atlas', 'palette', 'crops', 'frames', 'limitations'], 'manifest');
  if (manifest.schemaVersion !== 1 || manifest.id !== 'gate1-pixel32-content-first-crop-growth-stages' || manifest.assetKey !== 'crop.content-first-three') fail('manifest identity or schema version is unsupported');
  if (manifest.status !== 'candidate' || manifest.approved !== false) fail('manifest must remain status=candidate and approved=false');

  exactKeys(manifest.source, ['method', 'generator', 'generatorSha256', 'reference', 'crops'], 'manifest.source');
  if (manifest.source.generator !== 'tools/art/generate_gate1_crops.mjs') fail('source.generator must bind tools/art/generate_gate1_crops.mjs');
  exactKeys(manifest.source.reference, ['file', 'sha256', 'role'], 'manifest.source.reference');
  if (manifest.source.reference?.file !== REFERENCE.file || manifest.source.reference?.sha256 !== REFERENCE.sha256
    || manifest.source.reference?.role !== 'feature-reference-only; source pixels are not reused') fail('source reference is not the approved sweet-radish feature reference');
  const referenceBytes = await readRegular(join(ROOT, REFERENCE.file), 'sweet-radish feature reference', 2 * 1024 * 1024);
  if (sha256(referenceBytes) !== REFERENCE.sha256) fail('sweet-radish feature reference SHA-256 changed');
  if (!/^[a-f0-9]{64}$/.test(manifest.source.generatorSha256 ?? '')) fail('source.generatorSha256 must be a lowercase SHA-256 digest');
  const generatorBytes = await readRegular(GENERATOR, 'bound generator', MAX_GENERATOR_BYTES);
  if (sha256(generatorBytes) !== manifest.source.generatorSha256) fail('bound generator SHA-256 does not match manifest');
  if (!Array.isArray(manifest.source.crops) || JSON.stringify(manifest.source.crops.map(({ id }) => id)) !== JSON.stringify(['dew-grass', 'moon-bean', 'sweet-radish'])
    || manifest.source.crops.some((crop) => crop.method !== 'original hand-authored integer-pixel primitives; no external pixels sampled')) fail('source crop provenance must record original hand-authored pixels for all three crops');

  exactKeys(manifest.pixelContract, ['nativeTileSize', 'worldTileSize', 'displayScale', 'sampling', 'origin', 'rectConvention', 'anchorConvention'], 'manifest.pixelContract');
  if (manifest.pixelContract.nativeTileSize !== 32 || manifest.pixelContract.worldTileSize !== 64 || manifest.pixelContract.displayScale !== 2
    || manifest.pixelContract.sampling !== 'nearest-neighbor' || manifest.pixelContract.origin !== 'top-left'
    || manifest.pixelContract.rectConvention !== 'half-open' || manifest.pixelContract.anchorConvention !== 'integer-pixel-index') fail('pixelContract must follow the Pixel32 candidate contract');
  if (JSON.stringify(manifest.palette) !== JSON.stringify(COLORS)) fail('manifest.palette does not match the generator palette');
  exactKeys(manifest.atlas, ['file', 'width', 'height', 'colorType', 'sha256'], 'manifest.atlas');
  if (manifest.atlas.file !== 'sweet-radish-stages.png' || manifest.atlas.width !== 192 || manifest.atlas.height !== 96 || manifest.atlas.colorType !== 'RGBA8888') fail('atlas metadata must specify the 192x96 RGBA8888 three-crop atlas');
  if (!/^[a-f0-9]{64}$/.test(manifest.atlas.sha256 ?? '')) fail('atlas.sha256 must be a lowercase SHA-256 digest');
  if (!Array.isArray(manifest.limitations) || manifest.limitations.length !== 4 || manifest.limitations.some((entry) => typeof entry !== 'string')) fail('manifest.limitations must retain the four candidate limitations');

  const pngBytes = await readRegular(join(directory, manifest.atlas.file), 'candidate atlas', MAX_ATLAS_BYTES);
  if (sha256(pngBytes) !== manifest.atlas.sha256) fail('atlas SHA-256 does not match manifest');
  const image = decodeRgbaPng(pngBytes, 'candidate atlas');
  let transparent = false; let opaque = false;
  for (let offset = 0; offset < image.pixels.length; offset += 4) {
    const alpha = image.pixels[offset + 3];
    if (alpha === 0) { transparent = true; continue; }
    if (alpha !== 255) fail('candidate atlas must use only fully transparent or fully opaque pixels');
    opaque = true;
    const key = image.pixels.subarray(offset, offset + 4).toString('hex');
    if (!Object.values(COLORS).some((hex) => toRgbaKey(hex) === key)) fail('candidate atlas contains a pixel outside the recorded palette');
  }
  if (!transparent || !opaque) fail('candidate atlas must contain both transparent and opaque pixels');
  const crops = ['dew-grass', 'moon-bean', 'sweet-radish'];
  const atlasRows = { 'sweet-radish': 0, 'dew-grass': 32, 'moon-bean': 64 };
  const expectedStages = ['seed', 'sprout', 'growing-1', 'growing-2', 'flowering', 'mature'];
  const canonicalKeys = crops.flatMap((crop) => expectedStages.map((stage) => `crop.${crop}.${stage}`));
  exactKeys(manifest.frames, [...canonicalKeys, 'seed', 'sprout', 'mature'], 'manifest.frames');
  if (!Array.isArray(manifest.crops) || JSON.stringify(manifest.crops.map(({ id }) => id)) !== JSON.stringify(crops)) fail('manifest.crops must preserve the content-first crop order');
  for (const crop of manifest.crops) {
    exactKeys(crop, ['id', 'title', 'assetKey', 'frameKeys'], `crops.${crop.id}`);
    if (crop.assetKey !== `crop.${crop.id}` || JSON.stringify(crop.frameKeys) !== JSON.stringify(expectedStages.map((stage) => `crop.${crop.id}.${stage}`))) fail(`crops.${crop.id} frame contract is invalid`);
  }
  const seenCells = new Set(); const frameDigests = new Set();
  for (let cropIndex = 0; cropIndex < crops.length; cropIndex += 1) for (let index = 0; index < expectedStages.length; index += 1) {
    const cropId = crops[cropIndex]; const stage = expectedStages[index]; const key = `crop.${cropId}.${stage}`; const frame = manifest.frames[key];
    exactKeys(frame, ['x', 'y', 'width', 'height', 'nativeWidth', 'nativeHeight', 'footAnchor', 'pivot', 'kind', 'stage', 'tags', 'sha256'], `frames.${key}`);
    const expectedX = index * 32; const expectedY = atlasRows[cropId];
    if (frame.x !== expectedX || frame.y !== expectedY || frame.width !== 32 || frame.height !== 32 || frame.nativeWidth !== 32 || frame.nativeHeight !== 32) fail(`frames.${key} must occupy its aligned 32x32 native cell`);
    if (!integer(frame.x) || !integer(frame.y) || frame.x < 0 || frame.y < 0 || frame.x + frame.width > image.width || frame.y + frame.height > image.height) fail(`frames.${stage} is out of atlas bounds`);
    const cell = `${frame.x},${frame.y}`;
    if (seenCells.has(cell)) fail(`frames.${stage} overlaps another frame`);
    seenCells.add(cell);
    exactKeys(frame.footAnchor, ['x', 'y'], `frames.${stage}.footAnchor`);
    exactKeys(frame.pivot, ['x', 'y'], `frames.${stage}.pivot`);
    if (frame.footAnchor.x !== 16 || frame.footAnchor.y !== 31 || frame.pivot.x !== 16 || frame.pivot.y !== 31) fail(`frames.${stage} footAnchor and pivot must be (16,31)`);
    if (frame.kind !== 'cropOverlay' || frame.stage !== stage || JSON.stringify(frame.tags) !== JSON.stringify(['crop', cropId, stage, 'candidate'])) fail(`frames.${key} must retain its candidate crop stage metadata`);
    if (!/^[a-f0-9]{64}$/.test(frame.sha256 ?? '')) fail(`frames.${key}.sha256 must be a lowercase SHA-256 digest`);
    const frameHash = digestFrame(image, frame);
    if (frameHash !== frame.sha256) fail(`frames.${key}.sha256 does not match canonical RGBA pixels`);
    const cropDigestKey = `${cropId}:${frameHash}`;
    if (frameDigests.has(cropDigestKey)) fail(`${cropId} stage frames must be visually distinct`);
    frameDigests.add(cropDigestKey);
    const counts = colorCounts(image, frame);
    if (cropId === 'sweet-radish') {
      const rootPixels = ROOT_COLORS.reduce((sum, color) => sum + (counts.get(color) ?? 0), 0);
      const leafPixels = LEAF_COLORS.reduce((sum, color) => sum + (counts.get(color) ?? 0), 0);
      if (rootPixels === 0) fail(`${key} must show a red sweet-radish root/seed`);
      if (stage !== 'seed' && leafPixels === 0) fail(`${key} must show green sweet-radish leaves`);
      if (stage === 'mature' && rootPixels < 40) fail('crop.sweet-radish.mature must show a visibly developed red root');
    }
  }
  for (const stage of ['seed', 'sprout', 'mature']) {
    if (JSON.stringify(manifest.frames[stage]) !== JSON.stringify(manifest.frames[`crop.sweet-radish.${stage}`])) fail(`legacy ${stage} alias metadata (including footAnchor) must exactly match the canonical sweet-radish frame`);
  }

  const generated = await mkdtemp(join(tmpdir(), 'dewhollow-crop-repro-'));
  try {
    const result = spawnSync(process.execPath, [GENERATOR, '--output', generated], { encoding: 'utf8', timeout: 15000, maxBuffer: 64 * 1024 });
    if (result.error || result.status !== 0) fail(`bound generator failed during reproduction: ${result.error?.message ?? result.stderr ?? result.status}`);
    for (const file of ['manifest.json', 'sweet-radish-stages.png']) {
      const expected = await readFile(join(generated, file));
      const actual = await readFile(join(directory, file));
      if (!expected.equals(actual)) fail(`${file} does not reproduce from the bound generator`);
    }
  } finally {
    await rm(generated, { recursive: true, force: true });
  }
  return 'PASS: 18 Pixel32 crop frames across dew-grass, moon-bean, and sweet-radish; source, RGBA pixels, hashes, candidate state, and generator reproduction verified';
}

function parseArgs(args) {
  let manifest = DEFAULT_MANIFEST;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--manifest' && args[index + 1]) {
      manifest = isAbsolute(args[index + 1]) ? args[index + 1] : resolve(args[index + 1]); index += 1;
    } else throw new Error(`unsupported option: ${args[index]}`);
  }
  return manifest;
}

try {
  process.stdout.write(`${await check(parseArgs(process.argv.slice(2)))}\n`);
} catch (error) {
  process.stderr.write(`FAIL: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
