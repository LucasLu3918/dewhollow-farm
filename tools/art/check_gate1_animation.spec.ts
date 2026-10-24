import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateCandidateAnimation } from './check_gate1_animation.mjs';

const GENERATOR = resolve('tools/art/generate_gate1_animation.mjs');
const directories: string[] = [];

async function fixture(): Promise<string> {
  const directory = await mkdtemp(resolve(tmpdir(), 'dewhollow-animation-fixture-'));
  directories.push(directory);
  execFileSync(process.execPath, [GENERATOR, '--out-dir', directory], { timeout: 15_000 });
  return directory;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('Gate 1 候選動畫 checker', () => {
  it('接受可重現的 4 方向 32x48 候選圖集', async () => {
    expect(await validateCandidateAnimation(await fixture())).toEqual([]);
  });

  it('拒絕把候選動畫標記為已核准', async () => {
    const directory = await fixture();
    const path = resolve(directory, 'manifest.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    manifest.approved = true;
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
    expect((await validateCandidateAnimation(directory)).join('\n')).toContain('approved=false');
  });

  it('拒絕 manifest 指向不正確的候選工具圖路徑', async () => {
    const directory = await fixture();
    const path = resolve(directory, 'manifest.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    manifest.toolFeedback.frameSource = '../../16bit.png#tool';
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
    expect((await validateCandidateAnimation(directory)).join('\n')).toContain('candidate preview');
  });

  it('拒絕方向 frame 的腳錨漂移', async () => {
    const directory = await fixture();
    const path = resolve(directory, 'manifest.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    manifest.frames['up-contact-b'].footAnchor.y = 46;
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
    expect((await validateCandidateAnimation(directory)).join('\n')).toContain('footAnchor and pivot');
  });

  it('拒絕不符合 bound generator 的圖集像素', async () => {
    const directory = await fixture();
    const path = resolve(directory, 'player-4dir.png');
    const sheet = await readFile(path);
    sheet[sheet.length - 10] ^= 1;
    await writeFile(path, sheet);
    expect((await validateCandidateAnimation(directory)).join('\n')).toContain('atlas filename, dimensions, or sha256');
  });
});
