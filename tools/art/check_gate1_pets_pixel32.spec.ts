import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateCandidatePets } from './check_gate1_pets_pixel32.mjs';

const root = new URL('../../docs/art/candidates/pixel-movement/gate1-pets-pixel32/', import.meta.url).pathname;

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'dewhollow-pets-pixel32-spec-'));
  await cp(root, directory, { recursive: true });
  return {
    directory,
    manifestPath: join(directory, 'manifest.json'),
    readManifest: async () => JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')) as Record<string, any>,
    writeManifest: async (manifest: unknown) => writeFile(join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

describe('pixel32 cat and quokka candidate checker', () => {
  it('accepts exactly two unapproved species with complete direction/pose frames and reproducible outputs', async () => {
    expect(await validateCandidatePets(root)).toEqual([]);
  });

  it('rejects any approval state change', async () => {
    const f = await fixture();
    try {
      const manifest = await f.readManifest(); manifest.approved = true; await f.writeManifest(manifest);
      expect((await validateCandidatePets(f.directory)).join('\n')).toContain('candidate, approved=false');
    } finally { await f.cleanup(); }
  });

  it('rejects missing or altered species frames and foot anchors', async () => {
    const f = await fixture();
    try {
      const original = await f.readManifest();
      const missingFrame = structuredClone(original); delete missingFrame.frames['quokka-up-hop-a']; await f.writeManifest(missingFrame);
      expect((await validateCandidatePets(f.directory)).join('\n')).toContain('exactly 32');
      const alteredAnchor = structuredClone(original); alteredAnchor.frames['cat-down-idle'].footAnchor.y = 27; await f.writeManifest(alteredAnchor);
      expect((await validateCandidatePets(f.directory)).join('\n')).toContain('(16,28)');
    } finally { await f.cleanup(); }
  });

  it('rejects cross-direction clips, looping hops, and altered return semantics', async () => {
    const f = await fixture();
    try {
      const original = await f.readManifest();
      const crossDirection = structuredClone(original);
      crossDirection.animations.cat.down.hop.frames[0] = 'cat-up-hop-a';
      await f.writeManifest(crossDirection);
      expect((await validateCandidatePets(f.directory)).join('\n')).toContain('same-direction hop-a/hop-b/land');

      const loopingHop = structuredClone(original);
      loopingHop.animations.quokka.left.hop.loop = true;
      await f.writeManifest(loopingHop);
      expect((await validateCandidatePets(f.directory)).join('\n')).toContain('non-looping');

      const wrongReturn = structuredClone(original);
      wrongReturn.animations.cat.right.hop.returnTo = 'walk';
      await f.writeManifest(wrongReturn);
      expect((await validateCandidatePets(f.directory)).join('\n')).toContain('returning to idle');
    } finally { await f.cleanup(); }
  });

  it('rejects atlas byte corruption', async () => {
    const f = await fixture();
    try {
      const atlasPath = join(f.directory, 'pets-pixel32.png'); const bytes = await readFile(atlasPath); bytes[bytes.length - 5] ^= 0xff; await writeFile(atlasPath, bytes);
      expect((await validateCandidatePets(f.directory)).join('\n')).toMatch(/CRC|reproduce|atlas/);
    } finally { await f.cleanup(); }
  });
});
