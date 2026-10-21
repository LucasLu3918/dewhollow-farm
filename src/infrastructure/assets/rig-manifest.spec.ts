import { describe, expect, it } from 'vitest';
import assets from '../../../content/assets.json';
import rigs from '../../../content/rigs.json';
import { rigsFileSchema } from '../content/content-schema';
import type { AssetEntry, AssetManifest } from './asset-manifest';
import { rigProblems, WALK_PARAM_KEYS, type BipedRig, type RigDef, type RigManifest, type WholeRig } from './rig-manifest';

const character = (id: string, extra: Partial<AssetEntry> = {}): AssetEntry => ({
  id,
  kind: 'character',
  color: '#4a7fd0',
  file: `assets/characters/${id}.png`,
  density: 2,
  source: '本機模型生成（測試用）',
  ...extra,
});

/** 四方向都有正式圖片，朝右是朝左的翻轉；另有單張圖的毛毛與寵物。 */
const assetsOf = (...overrides: AssetEntry[]): AssetManifest => {
  const base: AssetEntry[] = [
    character('player.down'),
    character('player.up'),
    character('player.left'),
    { id: 'player.right', kind: 'character', mirrorOf: 'player.left', source: '水平翻轉 player.left' },
    character('npc.maomao'),
    character('pet.cat'),
  ];
  const byId = new Map(base.map((a) => [a.id, a]));
  for (const entry of overrides) byId.set(entry.id, entry);
  return { version: 1, assets: [...byId.values()] };
};

const rigOf = (overrides: Partial<BipedRig> = {}): BipedRig => ({
  id: 'player',
  kind: 'biped',
  textureSize: { width: 128, height: 160 },
  legTop: 130,
  views: { down: 'player.down', up: 'player.up', left: 'player.left', right: 'player.right' },
  splits: { down: 60, up: 60, left: 62 },
  ...overrides,
});

const wholeOf = (overrides: Partial<WholeRig> = {}): WholeRig => ({
  id: 'cat',
  kind: 'hop',
  textureSize: { width: 96, height: 96 },
  asset: 'pet.cat',
  ...overrides,
});

const manifestOf = (...list: RigDef[]): RigManifest => ({ version: 1, rigs: list });

describe('rigsFileSchema', () => {
  const parse = (value: unknown) => rigsFileSchema.safeParse({ version: 1, rigs: [value] });

  it('accepts a complete biped rig', () => {
    expect(parse(rigOf()).success).toBe(true);
  });

  it('accepts a single-picture rig and a hopping rig', () => {
    expect(parse(wholeOf()).success).toBe(true);
    expect(parse(wholeOf({ id: 'maomao', kind: 'single', asset: 'npc.maomao', textureSize: { width: 128, height: 160 } })).success).toBe(true);
  });

  it('rejects an unknown kind and a rig without the fields its kind needs', () => {
    expect(parse({ ...wholeOf(), kind: 'fly' }).success).toBe(false);
    expect(parse({ ...wholeOf(), asset: undefined }).success).toBe(false);
    expect(parse({ id: 'x', kind: 'biped', textureSize: { width: 1, height: 1 }, asset: 'a' }).success).toBe(false);
    const { kind: _kind, ...noKind } = rigOf();
    expect(parse(noKind).success).toBe(false);
  });

  it('accepts parameter overrides for known parameters only', () => {
    expect(parse(rigOf({ params: { bob: 5, lift: 3 } })).success).toBe(true);
    expect(parse(wholeOf({ params: { hopHeight: 20 } })).success).toBe(true);
    expect(parse({ ...rigOf(), params: { bogus: 1 } }).success).toBe(false);
    expect(parse({ ...rigOf(), params: { bob: '5' } }).success).toBe(false);
  });

  it('rejects a missing split, a fractional split and a non-positive legTop', () => {
    expect(parse({ ...rigOf(), splits: { down: 60, up: 60 } }).success).toBe(false);
    expect(parse({ ...rigOf(), splits: { down: 60.5, up: 60, left: 62 } }).success).toBe(false);
    expect(parse({ ...rigOf(), legTop: 0 }).success).toBe(false);
    expect(parse({ ...rigOf(), textureSize: { width: 0, height: 160 } }).success).toBe(false);
  });

  it('rejects a missing view and a wrong file version', () => {
    expect(parse({ ...rigOf(), views: { down: 'a', up: 'b', left: 'c' } }).success).toBe(false);
    expect(rigsFileSchema.safeParse({ version: 2, rigs: [] }).success).toBe(false);
  });

  it('lists exactly the parameters the walk animation has', () => {
    expect([...WALK_PARAM_KEYS].sort()).toEqual(
      [
        'airStretch',
        'bob',
        'breatheAmount',
        'breatheDelayMs',
        'breathePeriodMs',
        'footStretch',
        'hopHeight',
        'hopStretch',
        'lift',
        'swayDegrees',
      ].sort(),
    );
  });
});

describe('rigProblems: biped', () => {
  it('accepts a rig whose four views are real images, with right mirroring left', () => {
    expect(rigProblems(manifestOf(rigOf()), assetsOf())).toEqual([]);
  });

  it('accepts a right view that is its own image when it has its own split', () => {
    const own = character('player.right');
    expect(rigProblems(manifestOf(rigOf({ splits: { down: 60, up: 60, left: 62, right: 66 } })), assetsOf(own))).toEqual([]);
  });

  it('rejects two rigs with the same id', () => {
    expect(rigProblems(manifestOf(rigOf(), rigOf()), assetsOf())).toEqual(['rig id 重複：player']);
  });

  it('rejects a view that points at an asset that does not exist', () => {
    const rig = rigOf({ views: { down: 'player.down', up: 'player.nope', left: 'player.left', right: 'player.right' } });
    expect(rigProblems(manifestOf(rig), assetsOf())).toEqual(['rig player 的 up 素材 player.nope 不存在']);
  });

  it('rejects a view whose image is still a placeholder (a rig needs real texture frames)', () => {
    const placeholder: AssetEntry = { id: 'player.down', kind: 'character', color: '#4a7fd0', source: '占位（程式產生）' };
    expect(rigProblems(manifestOf(rigOf()), assetsOf(placeholder))).toEqual([
      'rig player 的 down 素材 player.down 沒有檔案，rig 只能用正式素材',
    ]);
  });

  it('rejects a view whose asset is not a character', () => {
    expect(rigProblems(manifestOf(rigOf()), assetsOf(character('player.up', { kind: 'tile' })))).toEqual([
      'rig player 的 up 素材 player.up 必須是 character',
    ]);
  });

  it('rejects mirroring in any view except right', () => {
    const mirrored: AssetEntry = { id: 'player.up', kind: 'character', mirrorOf: 'player.down', source: '翻轉' };
    expect(rigProblems(manifestOf(rigOf()), assetsOf(mirrored))).toEqual([
      'rig player 的 up 素材 player.up 不能是翻轉素材（只有 right 可以）',
    ]);
  });

  it('rejects a right view that mirrors something other than the left image', () => {
    const wrong: AssetEntry = { id: 'player.right', kind: 'character', mirrorOf: 'player.down', source: '翻轉' };
    expect(rigProblems(manifestOf(rigOf()), assetsOf(wrong))).toEqual([
      'rig player 的 right 素材 player.right 翻轉的不是 left 的素材 player.left',
    ]);
  });

  it('requires its own split when right is not a mirror of left', () => {
    expect(rigProblems(manifestOf(rigOf()), assetsOf(character('player.right')))).toEqual([
      'rig player 的 right 不是 left 的翻轉，必須設定 splits.right',
    ]);
  });

  it('refuses a right split when right is a mirror (the split is flipped from left)', () => {
    const rig = rigOf({ splits: { down: 60, up: 60, left: 62, right: 66 } });
    expect(rigProblems(manifestOf(rig), assetsOf())).toEqual(['rig player 的 right 由翻轉得到，不可設定 splits.right']);
  });

  it('keeps the leg line and the splits inside the texture', () => {
    expect(rigProblems(manifestOf(rigOf({ legTop: 160 })), assetsOf())).toEqual([
      'rig player 的 legTop 必須在 1 到 159 之間：160',
    ]);
    expect(rigProblems(manifestOf(rigOf({ splits: { down: 60, up: 60, left: 128 } })), assetsOf())).toEqual([
      'rig player 的 splits.left 必須在 1 到 127 之間：128',
    ]);
    expect(rigProblems(manifestOf(rigOf({ splits: { down: 0, up: 60, left: 62 } })), assetsOf())).toEqual([
      'rig player 的 splits.down 必須在 1 到 127 之間：0',
    ]);
  });
});

describe('rigProblems: single-picture and hopping rigs', () => {
  it('accepts a rig that points at a real character image', () => {
    expect(rigProblems(manifestOf(wholeOf()), assetsOf())).toEqual([]);
    expect(rigProblems(manifestOf(wholeOf({ id: 'maomao', kind: 'single', asset: 'npc.maomao' })), assetsOf())).toEqual([]);
  });

  it('rejects an asset that does not exist', () => {
    expect(rigProblems(manifestOf(wholeOf({ asset: 'pet.nope' })), assetsOf())).toEqual(['rig cat 的素材 pet.nope 不存在']);
  });

  it('rejects an asset that is still a placeholder', () => {
    const placeholder: AssetEntry = { id: 'pet.cat', kind: 'character', color: '#1d1d1f', source: '占位（程式產生）' };
    expect(rigProblems(manifestOf(wholeOf()), assetsOf(placeholder))).toEqual(['rig cat 的素材 pet.cat 沒有檔案，rig 只能用正式素材']);
  });

  it('rejects an asset that is not a character', () => {
    expect(rigProblems(manifestOf(wholeOf()), assetsOf(character('pet.cat', { kind: 'object' })))).toEqual([
      'rig cat 的素材 pet.cat 必須是 character',
    ]);
  });

  it('keeps ids unique across kinds', () => {
    expect(rigProblems(manifestOf(wholeOf(), wholeOf()), assetsOf())).toEqual(['rig id 重複：cat']);
  });
});

describe('shipped rigs', () => {
  const manifest = rigs as RigManifest;

  it('pass the schema and cross-reference the shipped assets without problems', () => {
    expect(rigsFileSchema.safeParse(rigs).success).toBe(true);
    expect(rigProblems(manifest, assets as AssetManifest)).toEqual([]);
  });

  it('describe the player as measured on the approved 2x masters', () => {
    const player = manifest.rigs.find((r) => r.id === 'player');
    expect(player).toMatchObject({
      kind: 'biped',
      textureSize: { width: 128, height: 160 },
      legTop: 130,
      views: { down: 'player.down', up: 'player.up', left: 'player.left', right: 'player.right' },
      splits: { down: 60, up: 60, left: 62 },
    });
    expect((player as BipedRig).splits.right).toBeUndefined();
  });

  it('give Maomao a single-picture rig and each pet a hopping rig, sized like their images', () => {
    const byId = new Map(manifest.rigs.map((r) => [r.id, r]));
    expect(byId.get('maomao')).toMatchObject({ kind: 'single', asset: 'npc.maomao', textureSize: { width: 128, height: 160 } });
    expect(byId.get('cat')).toMatchObject({ kind: 'hop', asset: 'pet.cat', textureSize: { width: 96, height: 96 } });
    expect(byId.get('marsupial')).toMatchObject({ kind: 'hop', asset: 'pet.marsupial', textureSize: { width: 96, height: 96 } });
  });
});
