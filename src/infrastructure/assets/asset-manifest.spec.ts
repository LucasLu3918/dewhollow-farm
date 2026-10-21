import { describe, expect, it } from 'vitest';
import assets from '../../../content/assets.json';
import { assetsFileSchema } from '../content/content-schema';
import { assetProblems, displayScale, missingFiles, type AssetEntry, type AssetManifest } from './asset-manifest';

function manifestOf(...entries: AssetEntry[]): AssetManifest {
  return { version: 1, assets: entries };
}

const real: AssetEntry = {
  id: 'player.down',
  kind: 'character',
  color: '#4a7fd0',
  file: 'assets/characters/xiaohan-2x.png',
  density: 2,
  source: '本機模型生成（Z-Image Turbo，Apache-2.0）後製',
};

describe('displayScale', () => {
  it('shows a normal asset at its own size', () => {
    expect(displayScale({ id: 'tile.grass', kind: 'tile', source: '占位（程式產生）' })).toBe(1);
  });

  it('shows a 2x master at half scale', () => {
    expect(displayScale(real)).toBe(0.5);
  });
});

describe('assetsFileSchema density', () => {
  const parse = (density: unknown) => assetsFileSchema.safeParse({ version: 1, assets: [{ ...real, density }] });

  it('accepts whole-number densities from 1 to 4', () => {
    for (const density of [1, 2, 3, 4]) expect(parse(density).success).toBe(true);
  });

  it('rejects zero, fractions and absurd values', () => {
    for (const density of [0, 1.5, 5, -2, '2']) expect(parse(density).success).toBe(false);
  });
});

describe('assetProblems', () => {
  it('accepts a real asset with a real source', () => {
    expect(assetProblems(manifestOf(real))).toEqual([]);
  });

  it('accepts a placeholder that has no file', () => {
    expect(assetProblems(manifestOf({ id: 'tile.grass', kind: 'tile', color: '#7fae6b', source: '占位（程式產生）' }))).toEqual([]);
  });

  it('rejects a file whose source still says placeholder (ORIGINALITY: every real asset needs a source)', () => {
    const problems = assetProblems(manifestOf({ ...real, source: '占位（程式產生）' }));
    expect(problems).toEqual(['素材 player.down 有檔案但來源仍是占位，請填寫實際來源與授權']);
  });

  it('rejects a density on an asset without a file', () => {
    const problems = assetProblems(manifestOf({ id: 'tile.grass', kind: 'tile', density: 2, source: '占位（程式產生）' }));
    expect(problems).toEqual(['素材 tile.grass 設了 density 卻沒有 file']);
  });

  it('rejects a file path that escapes the assets folder', () => {
    expect(assetProblems(manifestOf({ ...real, file: '../secret.png' }))).toEqual([
      '素材 player.down 的檔案路徑必須在 assets/ 底下：../secret.png',
    ]);
    expect(assetProblems(manifestOf({ ...real, file: '/etc/passwd' }))).toHaveLength(1);
  });

  it('rejects two assets that share an id', () => {
    expect(assetProblems(manifestOf(real, real))).toContain('素材 id 重複：player.down');
  });
});

describe('missingFiles', () => {
  it('lists assets whose file is not on disk', () => {
    const ghost = { ...real, id: 'npc.ghost', file: 'assets/characters/ghost-2x.png' };
    expect(missingFiles(manifestOf(real, ghost), new Set([real.file as string]))).toEqual([ghost]);
  });

  it('ignores placeholders', () => {
    expect(missingFiles(manifestOf({ id: 'tile.grass', kind: 'tile', source: '占位（程式產生）' }), new Set())).toEqual([]);
  });
});

describe('shipped assets', () => {
  // Vite 的 glob：鍵是專案根目錄起算的路徑；這裡只看有哪些檔案存在。
  const onDisk = new Set(Object.keys(import.meta.glob('/public/assets/**/*.png')).map((p) => p.replace('/public/', '')));
  const manifest = assets as AssetManifest;

  it('has every declared file in public/', () => {
    expect(missingFiles(manifest, onDisk).map((a) => a.file)).toEqual([]);
  });

  it('has no asset problems', () => {
    expect(assetProblems(manifest)).toEqual([]);
  });

  it('uses the approved 2x masters for the player and Maomao', () => {
    const byId = new Map(manifest.assets.map((a) => [a.id, a]));
    for (const id of ['player.up', 'player.down', 'player.left', 'player.right']) {
      expect(byId.get(id), id).toMatchObject({ file: 'assets/characters/xiaohan-2x.png', density: 2 });
    }
    expect(byId.get('npc.maomao')).toMatchObject({ file: 'assets/characters/maomao-2x.png', density: 2 });
  });

  it('registers the two pets as assets too', () => {
    const byId = new Map(manifest.assets.map((a) => [a.id, a]));
    expect(byId.get('pet.cat')).toMatchObject({ file: 'assets/characters/cat-2x.png', density: 2 });
    expect(byId.get('pet.marsupial')).toMatchObject({ file: 'assets/characters/marsupial-2x.png', density: 2 });
  });

  it('records where each real asset came from, including the model and seed', () => {
    for (const asset of manifest.assets.filter((a) => a.file)) {
      expect(asset.source, asset.id).toMatch(/Z-Image Turbo/);
      expect(asset.source, asset.id).toMatch(/seed \d+/);
    }
  });
});
