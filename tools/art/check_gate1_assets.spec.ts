import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const checkerPath = join(projectRoot, 'tools/art/check_gate1_assets.mjs');
const assetsPath = join(projectRoot, 'docs/art/candidates/pixel-movement/gate1-assets');
const temporaryDirectories: string[] = [];

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'dewhollow-art-check-'));
  temporaryDirectories.push(root);
  const assets = join(root, 'gate1-assets');
  cpSync(assetsPath, assets, { recursive: true });
  return {
    root,
    assets,
    manifestPath: join(assets, 'manifest.json'),
    readManifest: () => JSON.parse(readFileSync(join(assets, 'manifest.json'), 'utf8')) as any,
    writeManifest: (manifest: unknown) => writeFileSync(join(assets, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`),
    run: () => spawnSync(process.execPath, [checkerPath, '--manifest', join(assets, 'manifest.json')], { encoding: 'utf8' }),
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('Gate 1 pixel32 candidate asset checker', () => {
  it('accepts the complete candidate manifest and validates the real PNG pixels', () => {
    const fixture = createFixture();
    const result = fixture.run();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('PASS');
    expect(result.stdout).toContain('15 pixel32 frames');
  });

  it('rejects an asset promoted to approved by manifest metadata', () => {
    const fixture = createFixture();
    const manifest = fixture.readManifest();
    manifest.approved = true;
    fixture.writeManifest(manifest);

    const result = fixture.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('approved');
  });

  it('rejects overlapping atlas frames', () => {
    const fixture = createFixture();
    const manifest = fixture.readManifest();
    const frames = manifest.candidates.find((candidate: any) => candidate.id === '16bit').frames;
    frames.tilled.x = frames.grass.x;
    fixture.writeManifest(manifest);

    const result = fixture.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('overlap');
  });

  it('rejects a 32px frame moved off the declared atlas cell grid', () => {
    const fixture = createFixture();
    const manifest = fixture.readManifest();
    manifest.candidates.find((candidate: any) => candidate.id === '16bit').frames.grass.x += 1;
    fixture.writeManifest(manifest);

    const result = fixture.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('grid');
  });

  it('rejects an in-bounds foot anchor that does not match the frame-kind contract', () => {
    const fixture = createFixture();
    const manifest = fixture.readManifest();
    const grass = manifest.candidates.find((candidate: any) => candidate.id === '16bit').frames.grass;
    grass.footAnchor = { x: 0, y: 0 };
    grass.pivot = { x: 0, y: 0 };
    fixture.writeManifest(manifest);

    const result = fixture.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('must match the tile anchor');
  });

  it('rejects a recorded atlas digest that does not match the PNG bytes', () => {
    const fixture = createFixture();
    const manifest = fixture.readManifest();
    manifest.candidates.find((candidate: any) => candidate.id === '16bit').sha256 = '0'.repeat(64);
    fixture.writeManifest(manifest);

    const result = fixture.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('sha256');
  });

  it('rejects a PNG with an invalid chunk CRC', () => {
    const fixture = createFixture();
    const atlasPath = join(fixture.assets, '16bit.png');
    const bytes = readFileSync(atlasPath);
    bytes[bytes.length - 1] ^= 1;
    writeFileSync(atlasPath, bytes);

    const result = fixture.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('CRC');
  });

  it('rejects an atlas file before reading an oversized payload', () => {
    const fixture = createFixture();
    writeFileSync(join(fixture.assets, '16bit.png'), Buffer.alloc(1024 * 1024 + 1));

    const result = fixture.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('file limit');
  });

  it('rejects manifest output that is not reproduced by the bound generator', () => {
    const fixture = createFixture();
    const manifest = fixture.readManifest();
    manifest.limitations.push('manual metadata drift');
    fixture.writeManifest(manifest);

    const result = fixture.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('does not reproduce from generate.mjs');
  });
});
