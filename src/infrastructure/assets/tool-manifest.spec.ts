import { describe, expect, it } from 'vitest';
import assets from '../../../content/assets.json';
import tools from '../../../content/tools.json';
import { toolsFileSchema } from '../content/content-schema';
import type { AssetEntry, AssetManifest } from './asset-manifest';
import { toolProblems, toolTexturePixelSizes, type ToolDef, type ToolManifest } from './tool-manifest';

const objectAsset = (id: string, extra: Partial<AssetEntry> = {}): AssetEntry => ({
  id,
  kind: 'object',
  color: '#a0764e',
  file: `assets/tools/${id}.png`,
  density: 2,
  source: '本機模型生成（測試用）',
  ...extra,
});

const assetsOf = (...overrides: AssetEntry[]): AssetManifest => {
  const base = [objectAsset('tool.hoe'), objectAsset('tool.can')];
  const byId = new Map(base.map((a) => [a.id, a]));
  for (const entry of overrides) byId.set(entry.id, entry);
  return { version: 1, assets: [...byId.values()] };
};

const hoe: ToolDef = {
  id: 'hoe',
  action: 'till',
  asset: 'tool.hoe',
  textureSize: { width: 96, height: 96 },
  grip: { x: 30, y: 84 },
  swing: 'chop',
};
const can: ToolDef = { ...hoe, id: 'can', action: 'water', asset: 'tool.can', swing: 'pour' };
const manifestOf = (...list: ToolDef[]): ToolManifest => ({ version: 1, tools: list });

describe('toolsFileSchema', () => {
  const parse = (value: unknown) => toolsFileSchema.safeParse({ version: 1, tools: [value] });

  it('accepts a complete tool', () => {
    expect(parse(hoe).success).toBe(true);
  });

  it('rejects a swing or an action it does not know', () => {
    expect(parse({ ...hoe, swing: 'stab' }).success).toBe(false);
    expect(parse({ ...hoe, action: 'dance' }).success).toBe(false);
  });

  it('rejects a grip that is not a whole-number point, or a missing field', () => {
    expect(parse({ ...hoe, grip: { x: 1.5, y: 2 } }).success).toBe(false);
    expect(parse({ ...hoe, grip: { x: 1 } }).success).toBe(false);
    expect(parse({ ...hoe, asset: undefined }).success).toBe(false);
    expect(parse({ ...hoe, textureSize: { width: 0, height: 96 } }).success).toBe(false);
  });

  it('rejects a wrong file version', () => {
    expect(toolsFileSchema.safeParse({ version: 2, tools: [] }).success).toBe(false);
  });
});

describe('toolProblems', () => {
  it('accepts tools bound to different actions, with real object images', () => {
    expect(toolProblems(manifestOf(hoe, can), assetsOf())).toEqual([]);
  });

  it('rejects two tools with the same id', () => {
    expect(toolProblems(manifestOf(hoe, hoe), assetsOf())).toEqual(['工具 id 重複：hoe', '工具 hoe 與工具 hoe 綁定了同一個動作 till']);
  });

  it('rejects two tools bound to the same action, because the game could not tell which to show', () => {
    expect(toolProblems(manifestOf(hoe, { ...can, action: 'till' }), assetsOf())).toEqual([
      '工具 can 與工具 hoe 綁定了同一個動作 till',
    ]);
  });

  it('rejects an asset that does not exist', () => {
    expect(toolProblems(manifestOf({ ...hoe, asset: 'tool.nope' }), assetsOf())).toEqual(['工具 hoe 的素材 tool.nope 不存在']);
  });

  it('rejects an asset that is still a placeholder', () => {
    const placeholder: AssetEntry = { id: 'tool.hoe', kind: 'object', color: '#a0764e', source: '占位（程式產生）' };
    expect(toolProblems(manifestOf(hoe), assetsOf(placeholder))).toEqual(['工具 hoe 的素材 tool.hoe 沒有檔案，工具只能用正式素材']);
  });

  it('rejects an asset that is not an object', () => {
    expect(toolProblems(manifestOf(hoe), assetsOf(objectAsset('tool.hoe', { kind: 'tile' })))).toEqual([
      '工具 hoe 的素材 tool.hoe 必須是 object',
    ]);
  });

  it('keeps the grip inside the picture', () => {
    expect(toolProblems(manifestOf({ ...hoe, grip: { x: 200, y: 5 } }), assetsOf())).toEqual([
      '工具 hoe 的 grip (200,5) 必須在圖片 96×96 之內',
    ]);
    expect(toolProblems(manifestOf({ ...hoe, grip: { x: -1, y: 5 } }), assetsOf())).toEqual([
      '工具 hoe 的 grip (-1,5) 必須在圖片 96×96 之內',
    ]);
    // 邊界上的點算在圖片裡（握把常在圖片底邊）。
    expect(toolProblems(manifestOf({ ...hoe, grip: { x: 96, y: 96 } }), assetsOf())).toEqual([]);
  });
});

describe('toolTexturePixelSizes', () => {
  it('accepts both existing design-size files and density-scaled source files', () => {
    expect(toolTexturePixelSizes(hoe, objectAsset('tool.hoe'))).toEqual([
      { width: 192, height: 192 },
      { width: 96, height: 96 },
    ]);
  });

  it('keeps density-one and unspecified-density assets at their design dimensions', () => {
    expect(toolTexturePixelSizes(hoe, objectAsset('tool.hoe', { density: 1 }))).toEqual([{ width: 96, height: 96 }]);
    expect(toolTexturePixelSizes(hoe, objectAsset('tool.hoe', { density: undefined }))).toEqual([{ width: 96, height: 96 }]);
  });
});

describe('shipped tools', () => {
  const shipped = tools as ToolManifest;

  it('pass the schema and cross-reference the shipped assets without problems', () => {
    expect(toolsFileSchema.safeParse(tools).success).toBe(true);
    expect(toolProblems(shipped, assets as AssetManifest)).toEqual([]);
  });

  it('give each farming action its own tool and its own kind of swing', () => {
    const byAction = new Map(shipped.tools.map((t) => [t.action, t]));
    expect(byAction.get('till')).toMatchObject({ id: 'hoe', asset: 'tool.hoe', swing: 'chop' });
    expect(byAction.get('water')).toMatchObject({ id: 'can', asset: 'tool.can', swing: 'pour' });
    expect(byAction.get('plant')).toMatchObject({ id: 'seedbag', asset: 'tool.seedbag', swing: 'sow' });
  });

  it('show the sickle when a plant is gathered or a tuft is cut', () => {
    expect(shipped.tools.find((t) => t.id === 'sickle')).toMatchObject({ action: 'forage', asset: 'tool.sickle', swing: 'chop' });
  });

  it('are sized like their 2x images', () => {
    for (const tool of shipped.tools) expect(tool.textureSize, tool.id).toEqual({ width: 96, height: 96 });
  });
});
