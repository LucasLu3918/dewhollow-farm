#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { inflateSync } from 'node:zlib';

const DEFAULT_MANIFEST = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/art/candidates/pixel-movement/gate1-assets/manifest.json');
const EXPECTED_KEYS = ['grass', 'tilled', 'road', 'tree', 'cropSeed', 'cropSprout', 'cropMature', 'houseEdge', 'fence', 'playerIdle', 'playerWalk', 'cat', 'quokka', 'tool', 'shadow'];
const KIND_DIMENSIONS = {
  tile: { 16: [16, 16], 32: [32, 32] },
  tileOverlay: { 16: [16, 16], 32: [32, 32] },
  character: { 16: [16, 24], 32: [32, 48] },
  pet: { 16: [16, 16], 32: [32, 32] },
  object: { 16: [16, 16], 32: [32, 32] },
  shadow: { 16: [16, 8], 32: [32, 12] },
};
const EXPECTED_KINDS = {
  grass: 'tile', tilled: 'tile', road: 'tile', tree: 'tile', cropSeed: 'tileOverlay', cropSprout: 'tileOverlay', cropMature: 'tileOverlay',
  houseEdge: 'tile', fence: 'tileOverlay', playerIdle: 'character', playerWalk: 'character', cat: 'pet', quokka: 'pet', tool: 'object', shadow: 'shadow',
};
const EXPECTED_ANCHORS = {
  '8bit': { tile: [8, 15], character: [8, 23], pet: [8, 14], object: [8, 15], shadow: [8, 7] },
  '16bit': { tile: [16, 31], character: [16, 47], pet: [16, 28], object: [16, 31], shadow: [16, 11] },
};
const EXPECTED_ATLAS_DIMENSIONS = { '8bit': [64, 96], '16bit': [128, 192] };
const MAX_JSON_BYTES = 256 * 1024;
const MAX_GENERATOR_BYTES = 256 * 1024;
const MAX_ATLAS_BYTES = 1024 * 1024;
const MAX_DECODED_ATLAS_BYTES = 128 * 192 * 4 + 128 * 4 + 192;
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function readBounded(path, label, maxBytes) {
  const info = await stat(path);
  if (!info.isFile()) fail(`${label} is not a regular file`);
  if (info.size > maxBytes) fail(`${label} exceeds the ${maxBytes}-byte file limit`);
  return readFile(path);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, expected, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  for (const key of wanted) if (!(key in value)) errors.push(`${label}.${key} is required`);
  for (const key of actual) if (!wanted.includes(key)) errors.push(`${label}.${key} is not allowed`);
  return true;
}

function integer(value) {
  return Number.isSafeInteger(value);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodeRgbaPng(bytes, label, expectedWidth, expectedHeight) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) fail(`${label} is not a PNG`);
  let offset = 8;
  let header;
  let sawEnd = false;
  let chunkCount = 0;
  const compressed = [];
  while (offset + 12 <= bytes.length) {
    chunkCount += 1;
    if (chunkCount > 64) fail(`${label} has too many PNG chunks`);
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) fail(`${label} has a truncated PNG chunk`);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const crcInput = bytes.subarray(offset + 4, offset + 8 + length);
    if (crc32(crcInput) !== bytes.readUInt32BE(offset + 8 + length)) fail(`${label} has an invalid ${type} chunk CRC`);
    if (type === 'IHDR') {
      if (header || length !== 13) fail(`${label} has an invalid IHDR chunk`);
      header = {
        width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9],
        compression: data[10], filter: data[11], interlace: data[12],
      };
    } else if (type === 'IDAT') compressed.push(data);
    else if (type === 'IEND') {
      if (length !== 0) fail(`${label} has an invalid IEND chunk`);
      sawEnd = true;
      offset = end;
      break;
    }
    offset = end;
  }
  if (!header || !sawEnd || offset !== bytes.length) fail(`${label} has an incomplete PNG chunk sequence`);
  if (!integer(header.width) || !integer(header.height) || header.width <= 0 || header.height <= 0) fail(`${label} has invalid PNG dimensions`);
  if (header.width !== expectedWidth || header.height !== expectedHeight) fail(`${label} PNG dimensions must be ${expectedWidth}x${expectedHeight}`);
  if (header.bitDepth !== 8 || header.colorType !== 6 || header.compression !== 0 || header.filter !== 0 || header.interlace !== 0) {
    fail(`${label} must be non-interlaced 8-bit RGBA PNG`);
  }
  const stride = header.width * 4;
  const expectedInflatedLength = (stride + 1) * header.height;
  if (!Number.isSafeInteger(expectedInflatedLength) || expectedInflatedLength > MAX_DECODED_ATLAS_BYTES) fail(`${label} exceeds the decoded pixel limit`);
  const inflated = inflateSync(Buffer.concat(compressed), { maxOutputLength: expectedInflatedLength });
  if (inflated.length !== expectedInflatedLength) fail(`${label} has an invalid decompressed pixel length`);
  const pixels = Buffer.alloc(stride * header.height);
  for (let y = 0; y < header.height; y += 1) {
    const filter = inflated[y * (stride + 1)];
    const source = y * (stride + 1) + 1;
    const row = y * stride;
    if (filter > 4) fail(`${label} uses unsupported PNG filter ${filter}`);
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[source + x];
      const left = x >= 4 ? pixels[row + x - 4] : 0;
      const up = y > 0 ? pixels[row - stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[row - stride + x - 4] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : paeth(left, up, upperLeft);
      pixels[row + x] = (raw + predictor) & 0xff;
    }
  }
  return { ...header, pixels };
}

function frameDigest(image, rect) {
  const output = Buffer.alloc(8 + rect.width * rect.height * 4);
  output.writeUInt32BE(rect.width, 0);
  output.writeUInt32BE(rect.height, 4);
  let out = 8;
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    const start = (y * image.width + rect.x) * 4;
    const end = start + rect.width * 4;
    image.pixels.copy(output, out, start, end);
    out += rect.width * 4;
  }
  return sha256(output);
}

async function check(manifestPath) {
  const errors = [];
  const directory = dirname(manifestPath);
  let manifest;
  let manifestBytes;
  try {
    manifestBytes = await readBounded(manifestPath, 'manifest.json', MAX_JSON_BYTES);
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch (error) {
    fail(`manifest.json cannot be read: ${error instanceof Error ? error.message : String(error)}`);
  }

  const rootKeys = ['schemaVersion', 'title', 'status', 'approved', 'source', 'paletteFile', 'pixelContract', 'candidates', 'limitations'];
  exactKeys(manifest, rootKeys, 'manifest', errors);
  if (manifest.schemaVersion !== 2) errors.push('manifest.schemaVersion must be 2');
  if (manifest.status !== 'candidate' || manifest.approved !== false) errors.push('manifest must remain status=candidate and approved=false');
  exactKeys(manifest.source, ['method', 'generator', 'generatorSha256'], 'manifest.source', errors);
  if (manifest.source?.generator !== 'generate.mjs') errors.push('manifest.source.generator must be generate.mjs');
  if (!/^[a-f0-9]{64}$/.test(manifest.source?.generatorSha256 ?? '')) errors.push('manifest.source.generatorSha256 must be a lowercase SHA-256 digest');
  exactKeys(manifest.pixelContract, ['version', 'nativeTileSize', 'worldTileSize', 'displayScale', 'sampling', 'origin', 'rectConvention', 'anchorConvention', 'pivotConvention', 'atlasCell'], 'manifest.pixelContract', errors);
  const contract = manifest.pixelContract ?? {};
  if (contract.version !== 1 || contract.nativeTileSize !== 32 || contract.worldTileSize !== 64 || contract.displayScale !== 2) errors.push('manifest.pixelContract must specify 32px native tiles displayed 2x on the 64px world grid');
  if (contract.sampling !== 'nearest-neighbor' || contract.origin !== 'top-left' || contract.rectConvention !== 'half-open') errors.push('manifest.pixelContract has unsupported sampling or coordinate conventions');
  if (contract.anchorConvention !== 'integer-pixel-index' || contract.pivotConvention !== 'integer-pixel-index') errors.push('manifest.pixelContract anchors and pivots must use integer pixel indices');
  exactKeys(contract.atlasCell, ['width', 'height', 'columns', 'rows'], 'manifest.pixelContract.atlasCell', errors);
  if (contract.atlasCell?.width !== 32 || contract.atlasCell?.height !== 48 || contract.atlasCell?.columns !== 4 || contract.atlasCell?.rows !== 4) errors.push('manifest.pixelContract.atlasCell must be 32x48 with 4 columns and 4 rows');

  if (!Array.isArray(manifest.candidates) || manifest.candidates.length !== 2) errors.push('manifest.candidates must contain the 8bit and 16bit candidates');
  const candidateIds = new Set();
  let totalPixel32Frames = 0;
  for (const [candidateIndex, candidate] of (Array.isArray(manifest.candidates) ? manifest.candidates : []).entries()) {
    const label = `manifest.candidates[${candidateIndex}]`;
    exactKeys(candidate, ['id', 'candidateId', 'label', 'status', 'approved', 'tileSize', 'atlas', 'atlasWidth', 'atlasHeight', 'frames', 'sha256'], label, errors);
    if (candidateIds.has(candidate?.id)) errors.push(`${label}.id is duplicated`);
    candidateIds.add(candidate?.id);
    if (!['8bit', '16bit'].includes(candidate?.id)) errors.push(`${label}.id must be 8bit or 16bit`);
    if (candidate?.status !== 'candidate' || candidate?.approved !== false) errors.push(`${label} must remain candidate and approved=false`);
    const grid = candidate?.tileSize;
    if (![16, 32].includes(grid)) errors.push(`${label}.tileSize must be 16 or 32`);
    const isPixel32 = candidate?.id === '16bit';
    if (isPixel32 && grid !== 32) errors.push(`${label}.tileSize must be 32 for pixel32`);
    if (!isPixel32 && grid !== 16) errors.push(`${label}.tileSize must be 16 for pixel16`);
    if (typeof candidate?.atlas !== 'string' || candidate.atlas !== `${candidate.id}.png` || candidate.atlas.includes('/') || candidate.atlas.includes('\\')) errors.push(`${label}.atlas must be a local candidate PNG filename`);
    if (!/^[a-f0-9]{64}$/.test(candidate?.sha256 ?? '')) errors.push(`${label}.sha256 must be a lowercase SHA-256 digest`);
    const expectedAtlasDimensions = EXPECTED_ATLAS_DIMENSIONS[candidate?.id];
    if (expectedAtlasDimensions && (candidate.atlasWidth !== expectedAtlasDimensions[0] || candidate.atlasHeight !== expectedAtlasDimensions[1])) errors.push(`${label}.atlas dimensions must be ${expectedAtlasDimensions[0]}x${expectedAtlasDimensions[1]}`);
    if (!isRecord(candidate?.frames)) {
      errors.push(`${label}.frames must be an object`);
      continue;
    }
    const frameKeys = Object.keys(candidate.frames);
    if (frameKeys.length !== EXPECTED_KEYS.length || frameKeys.some((key, index) => key !== EXPECTED_KEYS[index])) errors.push(`${label}.frames must use the fixed 15-frame order`);
    const atlasCellWidth = grid;
    const atlasCellHeight = grid === 16 ? 24 : 48;
    const occupiedCells = new Set();
    let atlasBytes;
    let atlasImage;
    try {
      atlasBytes = await readBounded(join(directory, candidate.atlas), `${label}.atlas`, MAX_ATLAS_BYTES);
      atlasImage = decodeRgbaPng(atlasBytes, `${label}.atlas`, ...expectedAtlasDimensions);
    } catch (error) {
      errors.push(`${label}.atlas: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (sha256(atlasBytes) !== candidate.sha256) errors.push(`${label}.atlas sha256 does not match manifest`);
    if (atlasImage.width !== candidate.atlasWidth || atlasImage.height !== candidate.atlasHeight) errors.push(`${label}.atlas PNG dimensions do not match manifest`);
    if (candidate.atlasWidth % atlasCellWidth !== 0 || candidate.atlasHeight % atlasCellHeight !== 0) errors.push(`${label}.atlas dimensions must be divisible by the declared frame grid`);
    if (isPixel32 && (candidate.atlasWidth !== 128 || candidate.atlasHeight !== 192)) errors.push(`${label}.atlas must be 128x192 for the 4x4 32x48 frame grid`);
    let transparent = false;
    let opaque = false;
    for (let alpha = 3; alpha < atlasImage.pixels.length; alpha += 4) {
      if (atlasImage.pixels[alpha] === 0) transparent = true;
      else if (atlasImage.pixels[alpha] === 255) opaque = true;
    }
    if (!transparent || !opaque) errors.push(`${label}.atlas must contain both transparent and opaque pixels`);

    for (const key of EXPECTED_KEYS) {
      const frame = candidate.frames[key];
      const frameLabel = `${label}.frames.${key}`;
      exactKeys(frame, ['x', 'y', 'width', 'height', 'nativeWidth', 'nativeHeight', 'tileWidth', 'tileHeight', 'kind', 'footAnchor', 'pivot', 'tags', 'sha256'], frameLabel, errors);
      if (!frame || !isRecord(frame)) continue;
      if (frame.kind !== EXPECTED_KINDS[key]) errors.push(`${frameLabel}.kind must be ${EXPECTED_KINDS[key]}`);
      const expectedDimensions = KIND_DIMENSIONS[frame.kind]?.[grid];
      if (!expectedDimensions || frame.width !== expectedDimensions[0] || frame.height !== expectedDimensions[1]) errors.push(`${frameLabel} has dimensions that do not match its ${grid}px frame kind`);
      if (frame.nativeWidth !== frame.width || frame.nativeHeight !== frame.height) errors.push(`${frameLabel}.native dimensions must equal the unscaled frame dimensions`);
      if (frame.tileWidth !== grid || frame.tileHeight !== grid) errors.push(`${frameLabel}.tile dimensions must match candidate tileSize`);
      for (const [name, value] of [['x', frame.x], ['y', frame.y], ['width', frame.width], ['height', frame.height]]) {
        if (!integer(value) || value < (name === 'x' || name === 'y' ? 0 : 1)) errors.push(`${frameLabel}.${name} must be a positive integer pixel coordinate`);
      }
      if (integer(frame.x) && integer(frame.y) && integer(frame.width) && integer(frame.height)) {
        if (frame.x % atlasCellWidth !== 0 || frame.y % atlasCellHeight !== 0) errors.push(`${frameLabel} is off the ${atlasCellWidth}x${atlasCellHeight} frame grid`);
        if (frame.x + frame.width > candidate.atlasWidth || frame.y + frame.height > candidate.atlasHeight) errors.push(`${frameLabel} is outside atlas bounds`);
        const cell = `${frame.x / atlasCellWidth},${frame.y / atlasCellHeight}`;
        if (occupiedCells.has(cell)) errors.push(`${frameLabel} overlaps another frame in atlas cell ${cell}`);
        occupiedCells.add(cell);
      }
      for (const anchorName of ['footAnchor', 'pivot']) {
        const point = frame[anchorName];
        exactKeys(point, ['x', 'y'], `${frameLabel}.${anchorName}`, errors);
        if (!isRecord(point)) continue;
        if (!integer(point.x) || !integer(point.y) || point.x < 0 || point.y < 0 || point.x >= frame.width || point.y >= frame.height) errors.push(`${frameLabel}.${anchorName} must be an integer pixel inside its frame`);
        const expectedAnchor = EXPECTED_ANCHORS[candidate.id]?.[frame.kind];
        if (expectedAnchor && (point.x !== expectedAnchor[0] || point.y !== expectedAnchor[1])) errors.push(`${frameLabel}.${anchorName} must match the ${frame.kind} anchor (${expectedAnchor[0]}, ${expectedAnchor[1]})`);
      }
      if (isRecord(frame.footAnchor) && isRecord(frame.pivot) && (frame.pivot.x !== frame.footAnchor.x || frame.pivot.y !== frame.footAnchor.y)) errors.push(`${frameLabel}.pivot must match footAnchor for this candidate contract`);
      if (!Array.isArray(frame.tags) || frame.tags.length === 0 || frame.tags.some((tag) => typeof tag !== 'string' || !tag.trim()) || new Set(frame.tags).size !== frame.tags.length) errors.push(`${frameLabel}.tags must be a non-empty list of unique strings`);
      if (!/^[a-f0-9]{64}$/.test(frame.sha256 ?? '')) errors.push(`${frameLabel}.sha256 must be a lowercase SHA-256 digest`);
      else if (atlasImage && integer(frame.x) && integer(frame.y) && integer(frame.width) && integer(frame.height) && frame.x + frame.width <= atlasImage.width && frame.y + frame.height <= atlasImage.height) {
        if (frameDigest(atlasImage, frame) !== frame.sha256) errors.push(`${frameLabel}.sha256 does not match decoded atlas pixels`);
      }
    }
    if (isPixel32) totalPixel32Frames = frameKeys.length;
  }
  if (!candidateIds.has('8bit') || !candidateIds.has('16bit')) errors.push('manifest.candidates must include exactly one 8bit and one 16bit candidate');

  if (manifest.paletteFile !== 'palette.json') errors.push('manifest.paletteFile must be palette.json');
  let paletteBytes;
  try {
    paletteBytes = await readBounded(join(directory, manifest.paletteFile), 'palette.json', MAX_JSON_BYTES);
    const palette = JSON.parse(paletteBytes.toString('utf8'));
    if (palette.status !== 'candidate' || !isRecord(palette.palettes) || !isRecord(palette.palettes.a16) || !isRecord(palette.palettes.b32)) errors.push('palette.json must contain candidate a16 and b32 palettes');
  } catch (error) {
    errors.push(`palette.json cannot be read: ${error instanceof Error ? error.message : String(error)}`);
  }
  let generatorBytes;
  try {
    generatorBytes = await readBounded(join(directory, manifest.source.generator), 'generate.mjs', MAX_GENERATOR_BYTES);
    if (sha256(generatorBytes) !== manifest.source.generatorSha256) errors.push('manifest.source.generatorSha256 does not match generate.mjs');
  } catch (error) {
    errors.push(`generate.mjs cannot be read: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (errors.length === 0) {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'dewhollow-gate1-check-'));
    try {
      const temporaryGenerator = join(temporaryDirectory, 'generate.mjs');
      await writeFile(temporaryGenerator, generatorBytes);
      const generated = spawnSync(process.execPath, [temporaryGenerator], {
        cwd: temporaryDirectory,
        encoding: 'utf8',
        timeout: 15_000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
      if (generated.error || generated.status !== 0) {
        const reason = generated.error?.message ?? generated.stderr?.trim() ?? `exit ${generated.status}`;
        errors.push(`generate.mjs could not reproduce candidate outputs: ${reason}`);
      } else {
        const generatedManifest = await readBounded(join(temporaryDirectory, 'manifest.json'), 'generated manifest.json', MAX_JSON_BYTES);
        const generatedPalette = await readBounded(join(temporaryDirectory, 'palette.json'), 'generated palette.json', MAX_JSON_BYTES);
        if (sha256(generatedManifest) !== sha256(manifestBytes)) errors.push('manifest.json does not reproduce from generate.mjs');
        if (sha256(generatedPalette) !== sha256(paletteBytes)) errors.push('palette.json does not reproduce from generate.mjs');
        for (const candidate of manifest.candidates) {
          const generatedAtlas = await readBounded(join(temporaryDirectory, candidate.atlas), `generated ${candidate.atlas}`, MAX_ATLAS_BYTES);
          const currentAtlas = await readBounded(join(directory, candidate.atlas), candidate.atlas, MAX_ATLAS_BYTES);
          if (sha256(generatedAtlas) !== sha256(currentAtlas)) errors.push(`${candidate.atlas} does not reproduce from generate.mjs`);
        }
      }
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
  if (errors.length) {
    for (const message of errors) console.error(`FAIL: ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS: candidate-only 32px contract, atlas PNG integrity and ${totalPixel32Frames} pixel32 frames validated.`);
}

function parseArgs(args) {
  const options = { manifest: DEFAULT_MANIFEST };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node tools/art/check_gate1_assets.mjs [--manifest <path>]');
      process.exit(0);
    }
    if (arg === '--manifest') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) fail('--manifest requires a path');
      options.manifest = resolve(value);
      index += 1;
      continue;
    }
    if (isAbsolute(arg) || arg.startsWith('-')) fail(`unsupported option: ${arg}`);
    fail(`unexpected argument: ${arg}`);
  }
  return options;
}

try {
  await check(parseArgs(process.argv.slice(2)).manifest);
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
