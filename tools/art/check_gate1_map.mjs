#!/usr/bin/env node
/** Validate the isolated pixel32 map candidate without loading it into the game. */
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_MANIFEST = resolve(HERE, '../../docs/art/candidates/pixel-movement/gate1-assets/pixel32-map/manifest.json');
const GENERATOR = resolve(HERE, 'generate_gate1_map.mjs');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function fail(message) { throw new Error(`Gate 1 pixel32 map candidate: ${message}`); }
function crc32(bytes) {
  const table = crc32.table ??= Uint32Array.from({ length: 256 }, (_, n) => { let v = n; for (let i = 0; i < 8; i++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1; return v >>> 0; });
  let crc = 0xffffffff; for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0;
}

function parsePng(bytes) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!bytes.subarray(0, 8).equals(signature)) fail('atlas is not a PNG');
  let offset = 8; let dimensions = null; let ended = false; const imageChunks = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) fail('truncated PNG chunk');
    const length = bytes.readUInt32BE(offset); const end = offset + 12 + length;
    if (end > bytes.length) fail('PNG chunk exceeds the file boundary');
    const type = bytes.toString('ascii', offset + 4, offset + 8); const chunkData = bytes.subarray(offset + 8, offset + 8 + length);
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== bytes.readUInt32BE(offset + 8 + length)) fail(`PNG ${type} CRC mismatch`);
    if (type === 'IHDR') {
      if (length !== 13 || chunkData[8] !== 8 || chunkData[9] !== 6) fail('atlas must use 8-bit RGBA pixels');
      dimensions = { width: chunkData.readUInt32BE(0), height: chunkData.readUInt32BE(4) };
      if (dimensions.width > 1024 || dimensions.height > 1024) fail('PNG dimensions exceed the candidate decoder limit');
    }
    if (type === 'IDAT') imageChunks.push(chunkData);
    offset = end;
    if (type === 'IEND') { ended = true; break; }
  }
  if (!ended || offset !== bytes.length || !dimensions) fail('PNG structure is incomplete or has trailing data');
  const rowBytes = dimensions.width * 4 + 1;
  const decoded = inflateSync(Buffer.concat(imageChunks), { maxOutputLength: rowBytes * dimensions.height });
  if (decoded.length !== rowBytes * dimensions.height) fail('decoded PNG pixel data does not match atlas dimensions');
  return dimensions;
}

function parseArgs(args) {
  if (!args.length) return DEFAULT_MANIFEST;
  if (args.length !== 2 || args[0] !== '--manifest' || !args[1] || args[1].startsWith('-')) fail('usage: node check_gate1_map.mjs [--manifest <path>]');
  return resolve(args[1]);
}

async function main() {
  const manifestPath = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.status !== 'candidate' || manifest.approved !== false) fail('manifest must remain candidate and approved=false');
  if (manifest.pixelContract?.nativeTileSize !== 32 || manifest.pixelContract?.sampling !== 'nearest-neighbor') fail('pixel32 nearest-neighbor contract is missing');
  if (manifest.atlas?.file !== 'map-atlas.png') fail('atlas path must remain bound to map-atlas.png in the candidate directory');
  const seasons = ['spring', 'summer', 'autumn', 'winter'];
  if (JSON.stringify(manifest.seasons) !== JSON.stringify(seasons)) fail('all four seasons must be present in canonical order');
  if (manifest.autotile?.variantsPerSeason !== 16 || manifest.autotile?.maskBits?.north !== 1 || manifest.autotile?.maskBits?.west !== 8) fail('four-neighbor autotile mask contract is incomplete');
  const atlasPath = resolve(dirname(manifestPath), manifest.atlas?.file ?? '');
  const atlasInfo = await stat(atlasPath);
  if (atlasInfo.size > 2 * 1024 * 1024) fail('atlas exceeds the 2 MB candidate limit');
  const atlasBytes = await readFile(atlasPath);
  if (sha256(atlasBytes) !== manifest.atlas.sha256) fail('atlas SHA-256 does not match the manifest');
  const dimensions = parsePng(atlasBytes);
  if (dimensions.width !== manifest.atlas.width || dimensions.height !== manifest.atlas.height) fail('atlas dimensions do not match the manifest');
  const sourceHash = sha256(await readFile(GENERATOR));
  if (sourceHash !== manifest.source?.generatorSha256) fail('generator SHA-256 does not match the manifest; regenerate candidate files');

  const frames = manifest.frames;
  const frameEntries = Object.entries(frames);
  for (let i = 0; i < frameEntries.length; i++) {
    const [name, frame] = frameEntries[i];
    if (frame.approved !== false) fail(`frame ${name} must remain approved=false`);
    if (![frame.x, frame.y, frame.width, frame.height].every(Number.isInteger) || frame.x < 0 || frame.y < 0 || frame.width <= 0 || frame.height <= 0 || frame.x + frame.width > dimensions.width || frame.y + frame.height > dimensions.height) fail(`frame ${name} is outside the atlas or has invalid bounds`);
    if (frame.x % 32 !== 0 || frame.y % 32 !== 0) fail(`frame ${name} is not aligned to the native 32px grid`);
    for (let j = 0; j < i; j++) {
      const [otherName, other] = frameEntries[j];
      const overlaps = frame.x < other.x + other.width && frame.x + frame.width > other.x && frame.y < other.y + other.height && frame.y + frame.height > other.y;
      if (overlaps) fail(`frames ${otherName} and ${name} overlap`);
    }
  }
  for (const season of seasons) {
    for (const surface of ['grass', 'field', 'path', 'water']) if (!frames[`${season}-${surface}`]) fail(`missing ${season} ${surface} frame`);
    for (let mask = 0; mask < 16; mask++) {
      const frame = frames[`${season}-field-edge-${mask.toString(16)}`];
      if (!frame || frame.autotileMask !== mask || frame.season !== season || frame.width !== 32 || frame.height !== 32 || frame.approved !== false) fail(`invalid ${season} autotile frame ${mask.toString(16)}`);
    }
  }
  for (const [name, widthTiles, heightTiles, layer] of [['house-back', 3, 2, 'back'], ['house-front', 3, 2, 'front'], ['tree-canopy', 2, 2, 'front']]) {
    const frame = frames[name];
    if (!frame || frame.width !== widthTiles * 32 || frame.height !== heightTiles * 32 || frame.widthTiles !== widthTiles || frame.heightTiles !== heightTiles || frame.layer !== layer || frame.approved !== false) fail(`invalid multi-tile or occlusion frame ${name}`);
    if (!frame.footAnchor || frame.footAnchor.x < 0 || frame.footAnchor.x > frame.width || frame.footAnchor.y < 0 || frame.footAnchor.y > frame.height) fail(`${name} foot anchor is outside its frame`);
  }
  console.log(`PASS: ${Object.keys(frames).length} candidate frames, 4 seasons, 64 autotile variants, multi-tile building and canopy occlusion; atlas ${dimensions.width}x${dimensions.height} (${atlasInfo.size} bytes)`);
}

try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
