#!/usr/bin/env node
/** Read-only integrity and deterministic reproduction check for isolated pet candidates. */
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../docs/art/candidates/pixel-movement/gate1-pets-pixel32');
const GENERATOR = resolve(HERE, 'generate_gate1_pets_pixel32.mjs');
const MAX_MANIFEST_BYTES = 128 * 1024;
const MAX_ATLAS_BYTES = 1024 * 1024;
const W = 32;
const H = 32;
const SPECIES = ['cat', 'quokka'];
const DIRECTIONS = ['down', 'up', 'left', 'right'];
const POSES = ['idle', 'hop-a', 'hop-b', 'land'];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function boundedFile(path, label, maxBytes) {
  const info = await stat(path);
  if (!info.isFile()) throw new Error(`${label} must be a regular file`);
  if (info.size > maxBytes) throw new Error(`${label} exceeds the ${maxBytes}-byte file limit`);
  return readFile(path);
}

function exactKeys(object, keys) {
  return Boolean(object && typeof object === 'object' && !Array.isArray(object))
    && Object.keys(object).sort().join(',') === [...keys].sort().join(',');
}

function canonicalFrameDigest(width, height, rgba) {
  const data = Buffer.alloc(8 + rgba.length);
  data.writeUInt32BE(width, 0); data.writeUInt32BE(height, 4); rgba.copy(data, 8);
  return sha256(data);
}

function decodePng(bytes) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 57 || !bytes.subarray(0, 8).equals(signature)) throw new Error('atlas is not a PNG');
  const chunks = [];
  let offset = 8; let width; let height; let sawHeader = false; let sawEnd = false;
  const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset); const type = bytes.toString('ascii', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error(`truncated PNG ${type} chunk`);
    const payload = bytes.subarray(offset + 8, offset + 8 + length);
    const crcInput = bytes.subarray(offset + 4, offset + 8 + length);
    let crc = 0xffffffff;
    for (const byte of crcInput) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    if (((crc ^ 0xffffffff) >>> 0) !== bytes.readUInt32BE(offset + 8 + length)) throw new Error(`PNG ${type} CRC mismatch`);
    if (!sawHeader) {
      if (type !== 'IHDR' || length !== 13) throw new Error('PNG must start with one 13-byte IHDR');
      width = payload.readUInt32BE(0); height = payload.readUInt32BE(4);
      if (payload[8] !== 8 || payload[9] !== 6 || payload[10] !== 0 || payload[11] !== 0 || payload[12] !== 0) {
        throw new Error('PNG must use non-interlaced 8-bit RGBA');
      }
      sawHeader = true;
    } else if (type === 'IHDR') throw new Error('PNG has duplicate IHDR');
    if (type === 'IDAT') chunks.push(payload);
    if (type === 'IEND') { if (length !== 0 || end !== bytes.length) throw new Error('PNG IEND must be final and empty'); sawEnd = true; break; }
    offset = end;
  }
  if (!sawHeader || !sawEnd || width !== 256 || height !== 128) throw new Error('PNG dimensions must be 256x128');
  const filtered = inflateSync(Buffer.concat(chunks)); const rowBytes = width * 4;
  if (filtered.length !== (rowBytes + 1) * height) throw new Error('PNG decoded byte length is invalid');
  const rgba = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (rowBytes + 1);
    if (filtered[row] !== 0) throw new Error('PNG must use filter type 0 for deterministic atlas rows');
    filtered.copy(rgba, y * rowBytes, row + 1, row + 1 + rowBytes);
  }
  let transparent = false; let opaque = false;
  for (let i = 3; i < rgba.length; i += 4) { if (rgba[i] === 0) transparent = true; if (rgba[i] === 255) opaque = true; }
  if (!transparent || !opaque) throw new Error('atlas must contain transparent and opaque pixels');
  return { width, height, rgba };
}

function framePixels(image, x, y, width, height) {
  const out = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const start = ((y + row) * image.width + x) * 4;
    image.rgba.copy(out, row * width * 4, start, start + width * 4);
  }
  return out;
}

function validateShape(manifest, generatorHash, atlasBytes) {
  const rootKeys = ['schemaVersion', 'title', 'status', 'approved', 'source', 'pixelContract', 'atlas', 'species', 'directions', 'poses', 'frames', 'clips', 'referenceAssets', 'limitations'];
  if (!exactKeys(manifest, rootKeys)) throw new Error('manifest has missing or unexpected fields');
  if (manifest.schemaVersion !== 1 || manifest.status !== 'candidate' || manifest.approved !== false) throw new Error('manifest must stay schemaVersion=1, status=candidate, approved=false');
  if (!exactKeys(manifest.source, ['method', 'generator', 'generatorSha256'])
    || manifest.source.method !== 'hand-authored integer pixel primitives; approved static assets used only as species references'
    || manifest.source.generator !== 'tools/art/generate_gate1_pets_pixel32.mjs'
    || manifest.source.generatorSha256 !== generatorHash) throw new Error('generator source or digest does not match');
  if (!exactKeys(manifest.pixelContract, ['frameWidth', 'frameHeight', 'columns', 'rows', 'sampling', 'origin', 'rectConvention', 'displayScale'])
    || manifest.pixelContract.frameWidth !== 32 || manifest.pixelContract.frameHeight !== 32 || manifest.pixelContract.columns !== 8 || manifest.pixelContract.rows !== 4
    || manifest.pixelContract.sampling !== 'nearest-neighbor' || manifest.pixelContract.origin !== 'top-left'
    || manifest.pixelContract.rectConvention !== 'half-open' || manifest.pixelContract.displayScale !== 2) throw new Error('pixelContract must describe 8x4 32x32 nearest-neighbor frames at 2x');
  if (JSON.stringify(manifest.species) !== JSON.stringify(SPECIES) || JSON.stringify(manifest.directions) !== JSON.stringify(DIRECTIONS)
    || JSON.stringify(manifest.poses) !== JSON.stringify(POSES)) throw new Error('species, directions, or poses are incomplete or out of contract');
  const image = decodePng(atlasBytes);
  if (!exactKeys(manifest.atlas, ['file', 'width', 'height', 'sha256']) || manifest.atlas.file !== 'pets-pixel32.png'
    || manifest.atlas.width !== image.width || manifest.atlas.height !== image.height || manifest.atlas.sha256 !== sha256(atlasBytes)) throw new Error('atlas filename, dimensions, or sha256 does not match');
  const expectedFrames = DIRECTIONS.flatMap((direction, row) => SPECIES.flatMap((species, speciesIndex) => POSES.map((pose, poseIndex) => ({
    key: `${species}-${direction}-${pose}`, species, direction, pose, x: (speciesIndex * POSES.length + poseIndex) * W, y: row * H,
  }))));
  if (!exactKeys(manifest.frames, expectedFrames.map(({ key }) => key))) throw new Error('manifest must contain exactly 32 cat/quokka direction/pose frames');
  for (const expected of expectedFrames) {
    const frame = manifest.frames[expected.key];
    if (!exactKeys(frame, ['species', 'direction', 'pose', 'x', 'y', 'width', 'height', 'nativeWidth', 'nativeHeight', 'footAnchor', 'pivot', 'sha256'])
      || frame.species !== expected.species || frame.direction !== expected.direction || frame.pose !== expected.pose
      || frame.x !== expected.x || frame.y !== expected.y || frame.width !== W || frame.height !== H
      || frame.nativeWidth !== W || frame.nativeHeight !== H) throw new Error(`${expected.key} has invalid identity or rectangle`);
    if (!exactKeys(frame.footAnchor, ['x', 'y']) || frame.footAnchor.x !== 16 || frame.footAnchor.y !== 28
      || !exactKeys(frame.pivot, ['x', 'y']) || frame.pivot.x !== 16 || frame.pivot.y !== 28) throw new Error(`${expected.key} footAnchor and pivot must both equal (16,28)`);
    if (!/^[a-f0-9]{64}$/.test(frame.sha256)) throw new Error(`${expected.key} has an invalid frame digest`);
    const rgba = framePixels(image, expected.x, expected.y, W, H);
    if (canonicalFrameDigest(W, H, rgba) !== frame.sha256) throw new Error(`${expected.key} canonical pixel digest does not match atlas`);
    if (!rgba.some((_, i) => i % 4 === 3 && rgba[i] === 0) || !rgba.some((_, i) => i % 4 === 3 && rgba[i] === 255)) throw new Error(`${expected.key} must contain transparent and opaque pixels`);
  }
  for (const species of SPECIES) for (const direction of DIRECTIONS) {
    const poseDigests = POSES.map((pose) => manifest.frames[`${species}-${direction}-${pose}`].sha256);
    if (new Set(poseDigests).size !== POSES.length) throw new Error(`${species}-${direction} contains duplicate pose pixels`);
  }
  const references = {
    cat: { file: 'public/assets/characters/cat-2x.png', purpose: 'species traits only; new directions and animation are not approved', sha256: 'e128d8295d4d1fc8cf3ff52dc70d176b3b0ea8b6087a6f350b6feeef4c8468e5' },
    quokka: { file: 'public/assets/characters/marsupial-2x.png', purpose: 'species traits only; new directions and animation are not approved', sha256: '614fc13c48dab042962c7dc39f2353890d5f038e04076205a99cad27aed822d7' },
  };
  if (JSON.stringify(manifest.referenceAssets) !== JSON.stringify(references)) throw new Error('reference asset provenance or scope does not match');
  for (const species of SPECIES) {
    const clips = manifest.clips?.[species];
    if (!exactKeys(clips, ['idle', 'hop']) || clips.idle.loop !== true || clips.hop.loop !== true || clips.hop.frameDurationMs !== 130) throw new Error(`${species} clips are incomplete`);
    const idleFrames = DIRECTIONS.map((direction) => `${species}-${direction}-idle`);
    const hopFrames = DIRECTIONS.flatMap((direction) => [`${species}-${direction}-hop-a`, `${species}-${direction}-hop-b`, `${species}-${direction}-land`, `${species}-${direction}-idle`]);
    if (JSON.stringify(clips.idle.frames) !== JSON.stringify(idleFrames) || JSON.stringify(clips.hop.frames) !== JSON.stringify(hopFrames)) throw new Error(`${species} clip frame references do not match`);
  }
  if (!Array.isArray(manifest.limitations) || manifest.limitations.length !== 4 || manifest.limitations.some((item) => typeof item !== 'string')) throw new Error('candidate limitations must be present');
  return image;
}

export async function validateCandidatePets(directory = ROOT) {
  const errors = [];
  let manifest; let manifestBytes; let atlasBytes; let generatorBytes;
  try {
    manifestBytes = await boundedFile(resolve(directory, 'manifest.json'), 'manifest.json', MAX_MANIFEST_BYTES);
    manifest = JSON.parse(manifestBytes.toString('utf8'));
    atlasBytes = await boundedFile(resolve(directory, 'pets-pixel32.png'), 'pets-pixel32.png', MAX_ATLAS_BYTES);
    generatorBytes = await boundedFile(GENERATOR, 'generate_gate1_pets_pixel32.mjs', 128 * 1024);
    validateShape(manifest, sha256(generatorBytes), atlasBytes);
  } catch (error) {
    return [`${error instanceof Error ? error.message : String(error)}`];
  }
  const temp = await mkdtemp(resolve(tmpdir(), 'dewhollow-pets-pixel32-check-'));
  try {
    const generated = spawnSync(process.execPath, [GENERATOR, '--out-dir', temp], { cwd: temp, encoding: 'utf8', timeout: 15_000, maxBuffer: 1024 * 1024, windowsHide: true });
    if (generated.error || generated.status !== 0) errors.push(`candidate generator could not reproduce outputs: ${generated.error?.message ?? generated.stderr?.trim() ?? `exit ${generated.status}`}`);
    else {
      const generatedManifest = await boundedFile(resolve(temp, 'manifest.json'), 'generated manifest.json', MAX_MANIFEST_BYTES);
      const generatedAtlas = await boundedFile(resolve(temp, 'pets-pixel32.png'), 'generated pets-pixel32.png', MAX_ATLAS_BYTES);
      if (!generatedManifest.equals(manifestBytes)) errors.push('manifest.json does not reproduce from the bound generator');
      if (!generatedAtlas.equals(atlasBytes)) errors.push('pets-pixel32.png does not reproduce from the bound generator');
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const errors = await validateCandidatePets();
    if (errors.length) { for (const error of errors) console.error(`FAIL: ${error}`); process.exitCode = 1; }
    else console.log('PASS: isolated cat/quokka pixel32 candidate frames, species contract, hashes, and generator reproduction validated.');
  } catch (error) {
    console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1;
  }
}
