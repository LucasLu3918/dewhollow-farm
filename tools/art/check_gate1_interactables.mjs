#!/usr/bin/env node
/** Read-only integrity and reproducibility check for candidate-only interactables. */
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, lstat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { inflateSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/art/candidates/pixel-movement/gate1-assets/pixel32-interactables');
const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GENERATOR = resolve(dirname(fileURLToPath(import.meta.url)), 'generate_gate1_interactables.mjs');
const EXPECTED_FRAMES = [
  ['tool-hoe', 'tool', 'hoe', 'held-preview'], ['tool-can', 'tool', 'can', 'held-preview'], ['tool-seedbag', 'tool', 'seedbag', 'held-preview'],
  ['tool-axe', 'tool', 'axe', 'held-preview'], ['tool-pick', 'tool', 'pick', 'held-preview'], ['tool-rod', 'tool', 'rod', 'held-preview'],
  ['tool-sickle', 'tool', 'sickle', 'held-preview'], ['door-closed', 'door', 'closed', 'closed'], ['door-open', 'door', 'open', 'open'],
  ['shipbox-closed', 'shipbox', 'closed', 'closed'], ['shipbox-open', 'shipbox', 'open', 'open'],
];
const SOURCE_REFERENCES = [
  ['tool.hoe', 'public/assets/tools/hoe-2x.png', '03165e66002fbfa88fd441e4e16dd57b8e68d18dab1fa2c0631009fbb0a282a9'],
  ['tool.can', 'public/assets/tools/can-2x.png', '36c5a163e78ee23d6554b0f8fa9a031254390a1ec84f4fe4d3de86092a10f8dd'],
  ['tool.seedbag', 'public/assets/tools/seedbag-2x.png', '853d6e68096df186ebd975528730a9e5b8ea7c547724e40fd74bbc8ab0639ea0'],
  ['tool.axe', 'public/assets/tools/axe-2x.png', '90f03f34c83bccae6e627a536c86e4829dd2121b9d2dbd6538266fead3266f14'],
  ['tool.pick', 'public/assets/tools/pick-2x.png', '820e5e367cebcefe859a59a0aede6520537dd866242f8e3975afe232753d5ed7'],
  ['tool.rod', 'public/assets/tools/rod-2x.png', '9cd6037b12bf08e95696eb6e3e10ca40029f331e1deefc8eec42721a2158a2a7'],
  ['tool.sickle', 'public/assets/tools/sickle-2x.png', 'eca4d7932b5a5027e093ef47b4f1fc91e2f2f7f9378851ef3fcddff0424efdcc'],
  ['tile.door', 'public/assets/tiles/door-2x.png', 'c548d4ad9423b1aebb8d5c2992f05af686e63815b8897ef430c0a12013105a42'],
  ['tile.shipbox', 'public/assets/tiles/shipbox-2x.png', '82aa495601414f606c8bb1054ab5782186fd0bd2947533fb30d8e5076f642737'],
];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function exactKeys(object, keys) { return Object.keys(object ?? {}).sort().join(',') === [...keys].sort().join(','); }
function fail(message) { throw new Error(message); }
function sameJson(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function crc32(bytes) {
  const table = crc32.table ??= Uint32Array.from({ length: 256 }, (_, n) => { let v = n; for (let i = 0; i < 8; i += 1) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1; return v >>> 0; });
  let crc = 0xffffffff; for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0;
}

function decodePng(bytes) {
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  if (!bytes.subarray(0, 8).equals(signature)) fail('atlas is not a PNG');
  let offset = 8; let dimensions; let ended = false; const idat = []; let sawIdat = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) fail('truncated PNG chunk');
    const length = bytes.readUInt32BE(offset); const end = offset + 12 + length;
    if (end > bytes.length) fail('PNG chunk exceeds the file boundary');
    const type = bytes.toString('ascii', offset + 4, offset + 8); const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== bytes.readUInt32BE(offset + 8 + length)) fail(`PNG ${type} CRC mismatch`);
    if (offset === 8 && type !== 'IHDR') fail('IHDR must be the first PNG chunk');
    if (type === 'IHDR') {
      if (dimensions || length !== 13) fail('PNG must have exactly one valid IHDR');
      if (data[8] !== 8 || data[9] !== 6 || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) fail('atlas must be non-interlaced 8-bit RGBA PNG');
      dimensions = { width: data.readUInt32BE(0), height: data.readUInt32BE(4) };
      if (!dimensions.width || !dimensions.height || dimensions.width > 2048 || dimensions.height > 2048) fail('PNG dimensions are invalid or exceed decoder bounds');
    } else if (type === 'IDAT') {
      if (!dimensions || ended) fail('IDAT chunk is out of order'); sawIdat = true; idat.push(data);
    } else if (type === 'IEND') {
      if (length !== 0 || !sawIdat) fail('IEND is invalid or precedes image data'); ended = true; offset = end; break;
    } else {
      fail(`unsupported PNG chunk ${type}`);
    }
    offset = end;
  }
  if (!ended || offset !== bytes.length || !dimensions) fail('PNG structure is incomplete or has trailing data');
  const rowBytes = dimensions.width * 4; const raw = inflateSync(Buffer.concat(idat), { maxOutputLength: (rowBytes + 1) * dimensions.height });
  if (raw.length !== (rowBytes + 1) * dimensions.height) fail('decoded PNG pixel data does not match atlas dimensions');
  const pixels = Buffer.alloc(rowBytes * dimensions.height); let transparent = false; let opaque = false;
  for (let y = 0; y < dimensions.height; y += 1) {
    const row = y * (rowBytes + 1); const filter = raw[row];
    if (filter !== 0) fail('atlas rows must use deterministic filter type 0');
    raw.copy(pixels, y * rowBytes + 0, row + 1, row + 1 + rowBytes);
    for (let x = 3; x < rowBytes; x += 4) { if (pixels[y * rowBytes + x] === 0) transparent = true; if (pixels[y * rowBytes + x] === 255) opaque = true; }
  }
  if (!transparent || !opaque) fail('atlas must contain both transparent and opaque pixels');
  return { ...dimensions, pixels };
}

function frameDigest(image) {
  const header = Buffer.alloc(8); header.writeUInt32BE(image.width, 0); header.writeUInt32BE(image.height, 4);
  return sha256(Buffer.concat([header, image.pixels]));
}

function crop(image, rect) {
  const pixels = Buffer.alloc(rect.width * rect.height * 4);
  for (let y = 0; y < rect.height; y += 1) {
    const from = ((rect.y + y) * image.width + rect.x) * 4; const to = y * rect.width * 4;
    image.pixels.copy(pixels, to, from, from + rect.width * 4);
  }
  return { width: rect.width, height: rect.height, pixels };
}

export async function validateCandidateInteractables(directory = ROOT) {
  try {
    const manifestPath = resolve(directory, 'manifest.json'); const atlasPath = resolve(directory, 'interactables-atlas.png');
    const [manifestInfo, atlasInfo, manifestBytes, atlasBytes, generatorBytes] = await Promise.all([
      lstat(manifestPath), lstat(atlasPath), readFile(manifestPath), readFile(atlasPath), readFile(GENERATOR),
    ]);
    if (!manifestInfo.isFile() || manifestInfo.isSymbolicLink()) fail('manifest.json must be a regular file, not a symlink');
    if (!atlasInfo.isFile() || atlasInfo.isSymbolicLink()) fail('interactables-atlas.png must be a regular file, not a symlink');
    if (manifestInfo.size > 96 * 1024) fail('manifest.json exceeds the 96 KiB limit');
    if (atlasInfo.size > 2 * 1024 * 1024) fail('atlas exceeds the 2 MB candidate limit');
    let manifest;
    try { manifest = JSON.parse(manifestBytes.toString('utf8')); } catch { fail('manifest.json is not valid JSON'); }
    if (!exactKeys(manifest, ['schemaVersion', 'title', 'status', 'approved', 'source', 'pixelContract', 'atlas', 'frameLayout', 'frames', 'limitations'])) fail('manifest has missing or unexpected fields');
    if (manifest.schemaVersion !== 1 || manifest.status !== 'candidate' || manifest.approved !== false) fail('manifest must stay schemaVersion=1, status=candidate, approved=false');
    if (!exactKeys(manifest.source, ['method', 'generator', 'generatorSha256', 'references'])
      || manifest.source.generator !== 'tools/art/generate_gate1_interactables.mjs'
      || manifest.source.generatorSha256 !== sha256(generatorBytes)
      || manifest.source.method !== 'hand-authored integer pixel primitives informed by existing original project assets; source images are references, not resized inputs') {
      fail('source provenance or generator digest does not match');
    }
    if (!Array.isArray(manifest.source.references) || manifest.source.references.length !== SOURCE_REFERENCES.length) fail('source references are incomplete');
    for (let i = 0; i < SOURCE_REFERENCES.length; i += 1) {
      const [id, path, digest] = SOURCE_REFERENCES[i]; const reference = manifest.source.references[i];
      if (!exactKeys(reference, ['id', 'path', 'sha256']) || reference.id !== id || reference.path !== path || reference.sha256 !== digest) fail(`source reference ${id} is missing or changed`);
      const sourcePath = resolve(PROJECT, path); const sourceInfo = await stat(sourcePath);
      if (!sourceInfo.isFile() || sourceInfo.size > 2 * 1024 * 1024) fail(`source reference ${id} is not a bounded regular file`);
      if (sha256(await readFile(sourcePath)) !== digest) fail(`source reference ${id} SHA-256 no longer matches`);
    }
    if (!exactKeys(manifest.pixelContract, ['nativeTileSize', 'sampling', 'origin', 'rectConvention', 'anchorConvention'])
      || manifest.pixelContract.nativeTileSize !== 32 || manifest.pixelContract.sampling !== 'nearest-neighbor'
      || manifest.pixelContract.origin !== 'top-left' || manifest.pixelContract.rectConvention !== 'half-open'
      || manifest.pixelContract.anchorConvention !== 'integer-pixel-index') fail('pixelContract must describe native 32px nearest-neighbor frames');
    if (!exactKeys(manifest.atlas, ['file', 'width', 'height', 'sha256']) || manifest.atlas.file !== 'interactables-atlas.png'
      || manifest.atlas.width !== 128 || manifest.atlas.height !== 96 || manifest.atlas.sha256 !== sha256(atlasBytes)) fail('atlas filename, dimensions, or SHA-256 does not match');
    const image = decodePng(atlasBytes);
    if (image.width !== manifest.atlas.width || image.height !== manifest.atlas.height) fail('decoded atlas dimensions do not match manifest');
    if (!exactKeys(manifest.frameLayout, ['columns', 'rows', 'cellWidth', 'cellHeight'])
      || !sameJson(manifest.frameLayout, { columns: 4, rows: 3, cellWidth: 32, cellHeight: 32 })) fail('frameLayout must be a 4x3 grid of 32x32 cells');
    if (!Array.isArray(manifest.limitations) || manifest.limitations.length !== 5 || manifest.limitations.some((value) => typeof value !== 'string' || !value.trim())) fail('limitations must retain all five candidate boundary statements');
    if (!exactKeys(manifest.frames, EXPECTED_FRAMES.map(([key]) => key))) fail('manifest.frames must contain exactly the complete 11-frame candidate set');
    for (let index = 0; index < EXPECTED_FRAMES.length; index += 1) {
      const [key, category, item, state] = EXPECTED_FRAMES[index]; const frame = manifest.frames[key];
      const x = (index % 4) * 32; const y = Math.floor(index / 4) * 32;
      const frameKeys = category === 'tool'
        ? ['x', 'y', 'width', 'height', 'nativeWidth', 'nativeHeight', 'category', 'item', 'state', 'footAnchor', 'pivot', 'grip', 'sha256', 'approved']
        : ['x', 'y', 'width', 'height', 'nativeWidth', 'nativeHeight', 'category', 'item', 'state', 'footAnchor', 'pivot', 'sha256', 'approved'];
      if (!exactKeys(frame, frameKeys)) fail(`${key} has missing or unexpected fields`);
      if (frame.x !== x || frame.y !== y || frame.width !== 32 || frame.height !== 32 || frame.nativeWidth !== 32 || frame.nativeHeight !== 32
        || frame.category !== category || frame.item !== item || frame.state !== state || frame.approved !== false) fail(`${key} has invalid placement, identity, dimensions, or approval status`);
      if (!exactKeys(frame.footAnchor, ['x', 'y']) || frame.footAnchor.x !== 16 || frame.footAnchor.y !== 31 || !sameJson(frame.pivot, frame.footAnchor)) fail(`${key} footAnchor and pivot must both equal (16,31)`);
      if (category === 'tool' && (!exactKeys(frame.grip, ['x', 'y']) || !Number.isInteger(frame.grip.x) || !Number.isInteger(frame.grip.y) || frame.grip.x < 0 || frame.grip.x >= 32 || frame.grip.y < 0 || frame.grip.y >= 32)) fail(`${key} grip must be an integer pixel inside its 32x32 frame`);
      if (!/^[a-f0-9]{64}$/.test(frame.sha256 ?? '')) fail(`${key} has an invalid canonical frame digest`);
      if (frameDigest(crop(image, frame)) !== frame.sha256) fail(`${key} frame SHA-256 does not match decoded atlas pixels`);
    }
    const temp = await mkdtemp(resolve(tmpdir(), 'dewhollow-interactables-check-'));
    try {
      const generated = spawnSync(process.execPath, [GENERATOR, '--out-dir', temp], { encoding: 'utf8', timeout: 15_000, maxBuffer: 1024 * 1024, windowsHide: true });
      if (generated.error || generated.status !== 0) fail(`candidate generator could not reproduce outputs: ${generated.error?.message ?? generated.stderr?.trim() ?? `exit ${generated.status}`}`);
      const generatedManifest = await readFile(resolve(temp, 'manifest.json')); const generatedAtlas = await readFile(resolve(temp, 'interactables-atlas.png'));
      if (!generatedManifest.equals(manifestBytes)) fail('manifest.json does not reproduce byte-for-byte from its bound generator');
      if (!generatedAtlas.equals(atlasBytes)) fail('interactables-atlas.png does not reproduce byte-for-byte from its bound generator');
    } finally { await rm(temp, { recursive: true, force: true }); }
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

try {
  const args = process.argv.slice(2); let directory = ROOT;
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--candidate-dir' || !args[1] || args[1].startsWith('-')) throw new Error('Usage: node check_gate1_interactables.mjs [--candidate-dir <directory>]');
    directory = resolve(args[1]);
  }
  const errors = await validateCandidateInteractables(directory);
  if (errors.length) { for (const error of errors) console.error(`FAIL: ${error}`); process.exitCode = 1; }
  else console.log('PASS: candidate-only 11-frame Pixel32 interactables, provenance, anchors, hashes and deterministic outputs validated.');
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1;
}
