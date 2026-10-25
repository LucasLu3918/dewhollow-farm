import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateCandidateInteractables } from './check_gate1_interactables.mjs';

const GENERATOR = resolve('tools/art/generate_gate1_interactables.mjs');
const directories: string[] = [];

async function fixture(): Promise<string> {
  const directory = await mkdtemp(resolve(tmpdir(), 'dewhollow-interactables-spec-'));
  directories.push(directory);
  execFileSync(process.execPath, [GENERATOR, '--out-dir', directory], { timeout: 15_000 });
  return directory;
}

async function manifestAt(directory: string): Promise<{ manifest: any; path: string }> {
  const path = resolve(directory, 'manifest.json');
  return { manifest: JSON.parse(await readFile(path, 'utf8')) as any, path };
}

async function saveManifest(path: string, manifest: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

describe('Gate 1 Pixel32 互動物件候選 checker', () => {
  it('接受七種工具及門、船運箱開關狀態的完整候選，並重現 atlas/manifest', async () => {
    const errors = await validateCandidateInteractables(await fixture());
    expect(errors).toEqual([]);
  });

  it('拒絕候選或單一 frame 被標為 approved', async () => {
    const directory = await fixture(); const { manifest, path } = await manifestAt(directory);
    manifest.approved = true; await saveManifest(path, manifest);
    expect((await validateCandidateInteractables(directory)).join('\n')).toContain('status=candidate, approved=false');

    const { manifest: second, path: secondPath } = await manifestAt(directory);
    second.approved = false; second.frames['tool-hoe'].approved = true; await saveManifest(secondPath, second);
    expect((await validateCandidateInteractables(directory)).join('\n')).toContain('tool-hoe has invalid placement, identity, dimensions, or approval status');
  });

  it('拒絕缺漏或多出的 frame', async () => {
    const directory = await fixture(); const { manifest, path } = await manifestAt(directory);
    delete manifest.frames['door-open']; manifest.frames.extra = {};
    await saveManifest(path, manifest);
    expect((await validateCandidateInteractables(directory)).join('\n')).toContain('exactly the complete 11-frame candidate set');
  });

  it('拒絕錯誤 frame 錨點或工具握點', async () => {
    const directory = await fixture(); const { manifest, path } = await manifestAt(directory);
    manifest.frames['shipbox-open'].pivot.x = 15; await saveManifest(path, manifest);
    expect((await validateCandidateInteractables(directory)).join('\n')).toContain('shipbox-open footAnchor and pivot');

    const { manifest: second, path: secondPath } = await manifestAt(directory);
    second.frames['tool-can'].grip.x = 32; await saveManifest(secondPath, second);
    expect((await validateCandidateInteractables(directory)).join('\n')).toContain('tool-can grip must be an integer pixel inside');
  });

  it('拒絕來源素材 digest 漂移', async () => {
    const directory = await fixture(); const { manifest, path } = await manifestAt(directory);
    manifest.source.references[0].sha256 = '0'.repeat(64); await saveManifest(path, manifest);
    expect((await validateCandidateInteractables(directory)).join('\n')).toContain('source reference tool.hoe is missing or changed');
  });

  it('拒絕變更後未同步 atlas SHA-256 的圖集', async () => {
    const directory = await fixture(); const atlasPath = resolve(directory, 'interactables-atlas.png');
    const bytes = await readFile(atlasPath); bytes[bytes.length - 1] ^= 1; await writeFile(atlasPath, bytes);
    expect((await validateCandidateInteractables(directory)).join('\n')).toContain('atlas filename, dimensions, or SHA-256 does not match');
  });

  it('即使重新計算外層 digest，也拒絕 PNG CRC 損壞', async () => {
    const directory = await fixture(); const atlasPath = resolve(directory, 'interactables-atlas.png'); const { manifest, path } = await manifestAt(directory);
    const bytes = await readFile(atlasPath); bytes[bytes.length - 1] ^= 1; await writeFile(atlasPath, bytes);
    manifest.atlas.sha256 = createHash('sha256').update(bytes).digest('hex'); await saveManifest(path, manifest);
    expect((await validateCandidateInteractables(directory)).join('\n')).toContain('PNG IEND CRC mismatch');
  });

  it('拒絕重新綁定到不同 generator 的候選', async () => {
    const directory = await fixture(); const { manifest, path } = await manifestAt(directory);
    manifest.source.generatorSha256 = '0'.repeat(64); await saveManifest(path, manifest);
    expect((await validateCandidateInteractables(directory)).join('\n')).toContain('source provenance or generator digest does not match');
  });
});
