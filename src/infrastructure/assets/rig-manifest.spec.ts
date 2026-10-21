import { describe, expect, it } from 'vitest';
import assets from '../../../content/assets.json';
import rigs from '../../../content/rigs.json';
import { rigsFileSchema } from '../content/content-schema';
import type { AssetEntry, AssetManifest } from './asset-manifest';
import { rigProblems, WALK_PARAM_KEYS, type RigDef, type RigManifest } from './rig-manifest';

const character = (id: string, extra: Partial<AssetEntry> = {}): AssetEntry => ({
  id,
  kind: 'character',
  color: '#4a7fd0',
  file: `assets/characters/${id}.png`,
  density: 2,
  source: '本機模型生成（測試用）',
  ...extra,
});

/** 四方向都有正式圖片，朝右是朝左的翻轉。 */
const assetsOf = (...overrides: AssetEntry[]): AssetManifest => {
  const base: AssetEntry[] = [
    character('player.down'),
    character('player.up'),
    character('player.left'),
    { id: 'player.right', kind: 'character', mirrorOf: 'player.left', source: '水平翻轉 player.left' },
  ];
  const byId = new Map(base.map((a) => [a.id, a]));
  for (const entry of overrides) byId.set(entry.id, entry);
  return { version: 1, assets: [...byId.values()] };
};

const rigOf = (overrides: Partial<RigDef> = {}): RigDef => ({
  id: 'player',
  textureSize: { width: 128, height: 160 },
  legTop: 130,
  views: { down: 'player.down', up: 'player.up', left: 'player.left', right: 'player.right' },
  splits: { down: 60, up: 60, left: 62 },
  ...overrides,
});

const manifestOf = (...list: RigDef[]): RigManifest => ({ version: 1, rigs: list });

describe('rigsFileSchema', () => {
  const parse = (value: unknown) => rigsFileSchema.safeParse({ version: 1, rigs: [value] });

  it('accepts a complete rig', () => {
    expect(parse(rigOf()).success).toBe(true);
  });

  it('accepts parameter overrides for known parameters only', () => {
    expect(parse(rigOf({ params: { bob: 5, lift: 3 } })).success).toBe(true);
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
      ['airStretch', 'bob', 'breatheAmount', 'breatheDelayMs', 'breathePeriodMs', 'footStretch', 'lift', 'swayDegrees'].sort(),
    );
  });
});

describe('rigProblems', () => {
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

describe('shipped rigs', () => {
  const manifest = rigs as RigManifest;

  it('pass the schema and cross-reference the shipped assets without problems', () => {
    expect(rigsFileSchema.safeParse(rigs).success).toBe(true);
    expect(rigProblems(manifest, assets as AssetManifest)).toEqual([]);
  });

  it('describe the player as measured on the approved 2x masters', () => {
    const player = manifest.rigs.find((r) => r.id === 'player');
    expect(player).toMatchObject({
      textureSize: { width: 128, height: 160 },
      legTop: 130,
      views: { down: 'player.down', up: 'player.up', left: 'player.left', right: 'player.right' },
      splits: { down: 60, up: 60, left: 62 },
    });
    expect(player?.splits.right).toBeUndefined();
  });
});
