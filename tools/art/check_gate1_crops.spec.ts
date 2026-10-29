import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const checkerPath = join(projectRoot, 'tools/art/check_gate1_crops.mjs');
const candidatePath = join(projectRoot, 'docs/art/candidates/pixel-movement/gate1-assets/pixel32-crops');
const temporaryDirectories: string[] = [];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'dewhollow-crops-check-'));
  temporaryDirectories.push(root);
  const candidate = join(root, 'pixel32-crops');
  cpSync(candidatePath, candidate, { recursive: true });
  const manifestPath = join(candidate, 'manifest.json');
  return {
    candidate,
    manifestPath,
    readManifest: () => JSON.parse(readFileSync(manifestPath, 'utf8')) as any,
    writeManifest: (manifest: unknown) => writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`),
    run: () => spawnSync(process.execPath, [checkerPath, '--manifest', manifestPath], { encoding: 'utf8' }),
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('Gate 1 Pixel32 content-first crop candidate checker', () => {
  it('accepts the reproducible candidate atlas and verifies all three RGBA stages', () => {
    const current = fixture();
    const result = current.run();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('PASS');
    expect(result.stdout).toContain('18 Pixel32 crop frames across dew-grass, moon-bean, and sweet-radish');
  });

  it('rejects a candidate promoted to approved', () => {
    const current = fixture();
    const manifest = current.readManifest();
    manifest.approved = true;
    current.writeManifest(manifest);

    const result = current.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('candidate');
  });

  it('rejects any frame whose anchor differs from the Pixel32 contract', () => {
    const current = fixture();
    const manifest = current.readManifest();
    manifest.frames.sprout.footAnchor = { x: 15, y: 31 };
    current.writeManifest(manifest);

    const result = current.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('footAnchor');
  });

  it('rejects a source reference whose recorded digest is not the approved original', () => {
    const current = fixture();
    const manifest = current.readManifest();
    manifest.source.reference.sha256 = '0'.repeat(64);
    current.writeManifest(manifest);

    const result = current.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('reference');
  });

  it('rejects atlas bytes that do not match the manifest digest', () => {
    const current = fixture();
    const atlasPath = join(current.candidate, 'sweet-radish-stages.png');
    const bytes = readFileSync(atlasPath);
    bytes[bytes.length - 1] ^= 1;
    writeFileSync(atlasPath, bytes);

    const result = current.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/sha-?256|CRC/i);
  });

  it('rejects manifest edits that are not reproduced by the bound generator', () => {
    const current = fixture();
    const manifest = current.readManifest();
    manifest.title += ' untracked manual change';
    current.writeManifest(manifest);

    const result = current.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('reproduce');
  });
});
