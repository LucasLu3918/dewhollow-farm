import { describe, expect, it } from 'vitest';
import assets from '../../../content/assets.json';
import fish from '../../../content/fish.json';
import items from '../../../content/items.json';
import { assetsFileSchema } from '../content/content-schema';
import {
  assetProblems,
  displayScale,
  missingFiles,
  resolveAsset,
  resolveItemIcon,
  type AssetEntry,
  type AssetManifest,
} from './asset-manifest';

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

describe('assetsFileSchema itemIcons', () => {
  it('accepts an optional item-id to asset-path map', () => {
    expect(assetsFileSchema.safeParse({
      version: 1,
      assets: [],
      itemIcons: { 'item.sweet-radish': 'assets/items/sweet-radish.png' },
    }).success).toBe(true);
    expect(assetsFileSchema.safeParse({ version: 1, assets: [] }).success).toBe(true);
  });

  it('rejects map keys that are not item ids', () => {
    expect(assetsFileSchema.safeParse({
      version: 1,
      assets: [],
      itemIcons: { 'tile.grass': 'assets/items/sweet-radish.png' },
    }).success).toBe(false);
  });

  it('accepts canonical IDs from shipped inventory content, including dotted IDs', () => {
    const itemIcons = Object.fromEntries([
      ...items.items.map(({ id }) => [id, 'assets/items/example.png']),
      ...fish.fish.map(({ id }) => [`fish.${id}`, 'assets/items/example.png']),
      ['crop.sweet-radish', 'assets/items/example.png'],
      ['seed.sweet-radish', 'assets/items/example.png'],
    ]);

    expect(assetsFileSchema.safeParse({ version: 1, assets: [], itemIcons }).success).toBe(true);
  });

  it('rejects malformed canonical IDs and path-like keys', () => {
    for (const itemId of ['item.', '.wood', 'fish..carp', 'fish/carp', '../wood', ' wood', 'tile.grass']) {
      expect(assetsFileSchema.safeParse({
        version: 1,
        assets: [],
        itemIcons: { [itemId]: 'assets/items/example.png' },
      }).success, itemId).toBe(false);
    }
  });

  it('rejects paths outside the local item icon directory', () => {
    expect(assetsFileSchema.safeParse({
      version: 1,
      assets: [],
      itemIcons: { 'item.sweet-radish': '../private.png' },
    }).success).toBe(false);
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

describe('mirrorOf', () => {
  const left: AssetEntry = { ...real, id: 'player.left', file: 'assets/characters/xiaohan-side-2x.png' };
  const right: AssetEntry = {
    id: 'player.right',
    kind: 'character',
    color: '#4a7fd0',
    mirrorOf: 'player.left',
    source: '水平翻轉 player.left，不另存檔',
  };

  it('is accepted by the schema and must be a non-empty id', () => {
    const parse = (mirrorOf: unknown) =>
      assetsFileSchema.safeParse({ version: 1, assets: [{ id: 'a', kind: 'character', mirrorOf, source: 's' }] });
    expect(parse('player.left').success).toBe(true);
    expect(parse('').success).toBe(false);
    expect(parse(3).success).toBe(false);
  });

  it('is fine when it points at a real asset', () => {
    expect(assetProblems(manifestOf(left, right))).toEqual([]);
  });

  it('resolves to the texture of its target, flipped, at the target scale', () => {
    expect(resolveAsset(manifestOf(left, right), 'player.right')).toEqual({ textureId: 'player.left', flipX: true, scale: 0.5 });
  });

  it('resolves an ordinary asset to itself, not flipped', () => {
    expect(resolveAsset(manifestOf(left, right), 'player.left')).toEqual({ textureId: 'player.left', flipX: false, scale: 0.5 });
    expect(resolveAsset(manifestOf({ id: 'tile.grass', kind: 'tile', source: '占位（程式產生）' }), 'tile.grass')).toEqual({
      textureId: 'tile.grass',
      flipX: false,
      scale: 1,
    });
  });

  it('refuses to resolve an unknown asset instead of guessing', () => {
    expect(() => resolveAsset(manifestOf(left), 'player.nope')).toThrow('找不到素材：player.nope');
  });

  it('rejects a target that does not exist', () => {
    expect(assetProblems(manifestOf(right))).toEqual(['素材 player.right 的 mirrorOf 指向不存在的素材 player.left']);
  });

  it('rejects mirroring itself', () => {
    expect(assetProblems(manifestOf({ ...right, mirrorOf: 'player.right' }))).toEqual(['素材 player.right 不能翻轉自己']);
  });

  it('rejects mirroring another mirror (no chains, so no cycles)', () => {
    const second: AssetEntry = { ...right, id: 'player.again', mirrorOf: 'player.right' };
    expect(assetProblems(manifestOf(left, right, second))).toEqual([
      '素材 player.again 的 mirrorOf 指向另一個翻轉素材 player.right，請直接指向原圖',
    ]);
  });

  it('rejects a mirror that also has its own file or density', () => {
    expect(assetProblems(manifestOf(left, { ...right, file: 'assets/characters/x.png' }))).toEqual([
      '素材 player.right 設了 mirrorOf，就不能再有 file 或 density',
    ]);
    expect(assetProblems(manifestOf(left, { ...right, density: 2 }))).toEqual([
      '素材 player.right 設了 mirrorOf，就不能再有 file 或 density',
    ]);
  });

  it('rejects mirroring a different kind of asset', () => {
    expect(assetProblems(manifestOf(left, { ...right, kind: 'tile' }))).toEqual([
      '素材 player.right 的種類（tile）必須與 player.left 相同（character）',
    ]);
  });

  it('rejects a placeholder source on a mirror of real art', () => {
    expect(assetProblems(manifestOf(left, { ...right, source: '占位（程式產生）' }))).toEqual([
      '素材 player.right 翻轉的是正式素材，來源不能是占位',
    ]);
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

describe('itemIcons', () => {
  const iconManifest = (itemIcons?: Record<string, string>): AssetManifest => ({
    version: 1,
    assets: [],
    ...(itemIcons === undefined ? {} : { itemIcons }),
  });

  it('is optional for existing manifests', () => {
    expect(assetProblems(iconManifest())).toEqual([]);
    expect(resolveItemIcon(iconManifest(), 'item.sweet-radish', new Set(['item.sweet-radish']))).toEqual({
      status: 'missing',
      diagnostic: 'missing-icon',
    });
  });

  it('resolves a declared item icon only for a known item ID', () => {
    const manifest = iconManifest({ 'item.sweet-radish': 'assets/items/sweet-radish.png' });
    expect(resolveItemIcon(manifest, 'item.sweet-radish', new Set(['item.sweet-radish']))).toEqual({
      status: 'available',
      src: '/assets/items/sweet-radish.png',
    });
    expect(resolveItemIcon(manifest, 'item.unknown', new Set(['item.sweet-radish']))).toEqual({
      status: 'missing',
      diagnostic: 'unknown-item',
    });
  });

  it('validates and resolves canonical content IDs without rewriting them', () => {
    const itemIds = ['wood', 'fish.carp', 'recipe.sun-hat'];
    const itemIcons = Object.fromEntries(itemIds.map((id) => [id, `assets/items/${id.replaceAll('.', '-')}.png`]));
    const manifest = iconManifest(itemIcons);

    expect(assetProblems(manifest)).toEqual([]);
    for (const id of itemIds) {
      expect(resolveItemIcon(manifest, id, new Set(itemIds))).toEqual({
        status: 'available',
        src: `/${itemIcons[id]}`,
      });
    }
  });

  it('reports item icon entries with unsafe file paths', () => {
    expect(assetProblems(iconManifest({ 'item.sweet-radish': '../private.png' }))).toContain(
      '物品 item.sweet-radish 的圖示路徑必須在 assets/ 底下：../private.png',
    );
  });

  it('rejects malformed inventory IDs even when the manifest bypasses content schema parsing', () => {
    expect(assetProblems(iconManifest({ '../wood': 'assets/items/wood.png' }))).toContain(
      '物品圖示 id 格式無效：../wood',
    );
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

  it('gives the player a front, back and side image, and mirrors the side for facing right', () => {
    const byId = new Map(manifest.assets.map((a) => [a.id, a]));
    expect(byId.get('player.down')).toMatchObject({ file: 'assets/characters/xiaohan-2x.png', density: 2 });
    expect(byId.get('player.up')).toMatchObject({ file: 'assets/characters/xiaohan-back-2x.png', density: 2 });
    expect(byId.get('player.left')).toMatchObject({ file: 'assets/characters/xiaohan-side-2x.png', density: 2 });
    expect(byId.get('player.right')).toMatchObject({ mirrorOf: 'player.left' });
    expect(byId.get('player.right')?.file).toBeUndefined();
  });

  it('resolves facing right to the left image, flipped, at half scale', () => {
    expect(resolveAsset(manifest, 'player.right')).toEqual({ textureId: 'player.left', flipX: true, scale: 0.5 });
  });

  it('uses the approved 2x master for Maomao', () => {
    const maomao = manifest.assets.find((a) => a.id === 'npc.maomao');
    expect(maomao).toMatchObject({ file: 'assets/characters/maomao-2x.png', density: 2 });
  });

  it('registers the two pets as assets too', () => {
    const byId = new Map(manifest.assets.map((a) => [a.id, a]));
    expect(byId.get('pet.cat')).toMatchObject({ file: 'assets/characters/cat-2x.png', density: 2 });
    expect(byId.get('pet.marsupial')).toMatchObject({ file: 'assets/characters/marsupial-2x.png', density: 2 });
  });

  it('records the generation source for every shipped asset', () => {
    // 舊素材保留 Z-Image 與 seed；新素材記錄內建產圖工具與後製流程。
    for (const asset of manifest.assets.filter((a) => a.file && !a.source.startsWith('程式產生'))) {
      expect(asset.source, asset.id).toMatch(/(?:Z-Image Turbo.*seed \d+|OpenAI built-in image generation tool)/);
    }
  });
});
