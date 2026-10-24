import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const checkerPath = join(projectRoot, 'tools/art/check_gate1_map.mjs');
const generatorPath = join(projectRoot, 'tools/art/generate_gate1_map.mjs');
const candidatePath = join(projectRoot, 'docs/art/candidates/pixel-movement/gate1-assets/pixel32-map');
const temporaryDirectories: string[] = [];

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
    expect(result.stdout).toContain('64 autotile variants');
    expect(result.stdout).toContain('multi-tile building and canopy occlusion');
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
  });
});
