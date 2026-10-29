import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { measureTileWrapSeams, summarizeFrameAlpha } from './map_tile_seams.mjs';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const checkerPath = join(projectRoot, 'tools/art/check_gate1_map.mjs');
const generatorPath = join(projectRoot, 'tools/art/generate_gate1_map.mjs');
const candidatePath = join(projectRoot, 'docs/art/candidates/pixel-movement/gate1-assets/pixel32-map');
const temporaryDirectories: string[] = [];

function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return chunk;
}

function mutatePngRgba(bytes: Buffer, width: number, height: number, mutate: (pixels: Buffer) => void): Buffer {
  const signature = bytes.subarray(0, 8);
  const chunks: Array<{ type: string; data: Buffer }> = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data: Buffer.from(data) });
    offset += length + 12;
  }
  const ihdr = chunks.find(({ type }) => type === 'IHDR')!.data;
  const idat = Buffer.concat(chunks.filter(({ type }) => type === 'IDAT').map(({ data }) => data));
  const rowBytes = width * 4 + 1;
  const raw = inflateSync(idat);
  expect(raw.length).toBe(rowBytes * height);
  for (let y = 0; y < height; y += 1) expect(raw[y * rowBytes]).toBe(0);
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) raw.copy(pixels, y * width * 4, y * rowBytes + 1, (y + 1) * rowBytes);
  mutate(pixels);
  const encoded = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y += 1) pixels.copy(encoded, y * rowBytes + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(encoded)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'dewhollow-map-check-'));
  temporaryDirectories.push(root);
  cpSync(candidatePath, join(root, 'candidate'), { recursive: true });
  const manifestPath = join(root, 'candidate/manifest.json');
  return {
    manifestPath,
    readManifest: () => JSON.parse(readFileSync(manifestPath, 'utf8')) as any,
    writeManifest: (manifest: unknown) => writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`),
    run: () => spawnSync(process.execPath, [checkerPath, '--manifest', manifestPath], { encoding: 'utf8' }),
  };
}

afterEach(() => { for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe('Gate 1 pixel32 map candidate checker', () => {
  it('accepts the complete four-season candidate', () => {
    const result = fixture().run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('225 candidate frames');
    expect(result.stdout).toContain('64 field-edge and 128 dry/wet soil autotile variants');
    expect(result.stdout).toContain('multi-tile building and canopy occlusion');
  });

  it('requires tileable dry/wet soil and indoor surface frames with a transparent ground shadow', () => {
    const candidate = fixture();
    const result = candidate.run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('7 tileable surface families');
    expect(result.stdout).toContain('transparent ground shadow');
  });

  it('rejects a seasonal base surface that is not marked tileable', () => {
    const candidate = fixture();
    const manifest = candidate.readManifest();
    manifest.frames['spring-grass'].tileable = false;
    candidate.writeManifest(manifest);
    const result = candidate.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('invalid spring grass tileable frame');
  });

  it('accepts matching edges on a repeated rgba tile and reports a broken wrap edge', () => {
    const width = 32;
    const pixels = new Uint8Array(width * width * 4);
    for (let i = 0; i < width * width; i++) {
      pixels.set([90, 100, 110, 255], i * 4);
    }
    const frame = { x: 0, y: 0, width, height: width };
    expect(measureTileWrapSeams(pixels, width, frame).maxChannelDelta).toBe(0);
    pixels[(5 * width + (width - 1)) * 4] = 0;
    expect(measureTileWrapSeams(pixels, width, frame).maxChannelDelta).toBeGreaterThan(0);
  });

  it('requires a ground shadow to have partial alpha and transparent borders', () => {
    const width = 32;
    const height = 12;
    const pixels = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) pixels.set([40, 40, 40, 0], i * 4);
    const frame = { x: 0, y: 0, width, height };
    const alpha = (y: number, x: number, value: number) => { pixels[(y * width + x) * 4 + 3] = value; };
    alpha(5, 10, 90);
    alpha(5, 11, 148);
    alpha(5, 12, 255);
    expect(summarizeFrameAlpha(pixels, width, frame)).toMatchObject({
      transparentPixels: width * height - 3,
      partialAlphaPixels: 2,
      opaquePixels: 1,
      transparentBorderPixels: width * 2 + (height - 2) * 2,
    });
  });

  it('rejects a real pixel mismatch across the repeated RGBA tile edge', () => {
    const candidate = fixture();
    const manifest = candidate.readManifest();
    const atlasPath = join(candidate.manifestPath, '..', 'map-atlas.png');
    const original = readFileSync(atlasPath);
    const frame = manifest.frames['spring-grass'];
    const changed = mutatePngRgba(original, manifest.atlas.width, manifest.atlas.height, (pixels) => {
      const index = ((frame.y + 7) * manifest.atlas.width + frame.x + frame.width - 1) * 4;
      pixels[index] ^= 1;
    });
    writeFileSync(atlasPath, changed);
    manifest.atlas.sha256 = createHash('sha256').update(changed).digest('hex');
    candidate.writeManifest(manifest);
    const result = candidate.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('spring-grass has a wrapped RGBA edge seam');
  });

  it('rejects a ground shadow whose atlas pixels no longer contain partial alpha', () => {
    const candidate = fixture();
    const manifest = candidate.readManifest();
    const atlasPath = join(candidate.manifestPath, '..', 'map-atlas.png');
    const original = readFileSync(atlasPath);
    const frame = manifest.frames['ground-shadow'];
    const changed = mutatePngRgba(original, manifest.atlas.width, manifest.atlas.height, (pixels) => {
      for (let y = frame.y; y < frame.y + frame.height; y += 1) {
        for (let x = frame.x; x < frame.x + frame.width; x += 1) pixels[(y * manifest.atlas.width + x) * 4 + 3] = 0;
      }
    });
    writeFileSync(atlasPath, changed);
    manifest.atlas.sha256 = createHash('sha256').update(changed).digest('hex');
    candidate.writeManifest(manifest);
    const result = candidate.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('ground shadow must contain transparent and partial-alpha pixels');
  });

  it('rejects a candidate promoted to approved', () => {
    const candidate = fixture(); const manifest = candidate.readManifest(); manifest.approved = true; candidate.writeManifest(manifest);
    const result = candidate.run();
    expect(result.status).not.toBe(0); expect(result.stderr).toContain('approved=false');
  });

  it('rejects a missing seasonal autotile mask', () => {
    const candidate = fixture(); const manifest = candidate.readManifest(); delete manifest.frames['winter-field-edge-f']; candidate.writeManifest(manifest);
    const result = candidate.run();
    expect(result.status).not.toBe(0); expect(result.stderr).toContain('winter autotile frame f');
  });

  it('rejects overlapping atlas frames', () => {
    const candidate = fixture(); const manifest = candidate.readManifest();
    manifest.frames['spring-field'].x = manifest.frames['spring-grass'].x;
    manifest.frames['spring-field'].y = manifest.frames['spring-grass'].y;
    candidate.writeManifest(manifest);
    const result = candidate.run();
    expect(result.status).not.toBe(0); expect(result.stderr).toContain('spring-grass and spring-field overlap');
  });

  it('rejects atlas bytes that no longer match the manifest hash', () => {
    const candidate = fixture(); const atlasPath = join(candidate.manifestPath, '..', 'map-atlas.png');
    const bytes = readFileSync(atlasPath); bytes[bytes.length - 1] ^= 1; writeFileSync(atlasPath, bytes);
    const result = candidate.run();
    expect(result.status).not.toBe(0); expect(result.stderr).toContain('SHA-256');
  });

  it('rejects a malformed atlas chunk checksum', () => {
    const candidate = fixture(); const atlasPath = join(candidate.manifestPath, '..', 'map-atlas.png');
    const bytes = readFileSync(atlasPath); bytes[bytes.length - 1] ^= 1;
    const manifest = candidate.readManifest();
    manifest.atlas.sha256 = createHash('sha256').update(bytes).digest('hex'); candidate.writeManifest(manifest); writeFileSync(atlasPath, bytes);
    const result = candidate.run();
    expect(result.status).not.toBe(0); expect(result.stderr).toContain('PNG IEND CRC mismatch');
  });

  it('reproduces the committed atlas and manifest byte-for-byte', () => {
    const candidate = fixture();
    const root = candidate.manifestPath.slice(0, candidate.manifestPath.indexOf('/candidate/'));
    const generatedRoot = join(root, 'reproduced');
    const generatorCopy = join(generatedRoot, 'tools/art/generate_gate1_map.mjs');
    mkdirSync(join(generatedRoot, 'tools/art'), { recursive: true });
    cpSync(generatorPath, generatorCopy);
    const result = spawnSync(process.execPath, [generatorCopy], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    const generatedDir = join(generatedRoot, 'docs/art/candidates/pixel-movement/gate1-assets/pixel32-map');
    expect(readFileSync(join(generatedDir, 'manifest.json'))).toEqual(readFileSync(candidate.manifestPath));
    expect(readFileSync(join(generatedDir, 'map-atlas.png'))).toEqual(readFileSync(join(candidate.manifestPath, '..', 'map-atlas.png')));
  }, 30_000);
});
