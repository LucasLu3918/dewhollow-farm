import type { AssetEntry, AssetManifest } from './asset-manifest';

/**
 * 角色骨架（rig）資料：把一張角色圖切成「上半身＋兩隻腳」所需的量測值。
 * 做法見 docs/ANIMATION_DESIGN.md。量測是針對 2x 母版圖片的原始像素。
 */

export type RigView = 'down' | 'up' | 'left' | 'right';
export const RIG_VIEWS: readonly RigView[] = ['down', 'up', 'left', 'right'];

/** 走路參數的名稱。與 presentation/walk-pose.ts 的 WalkParams 必須一致（有測試守護）。 */
export const WALK_PARAM_KEYS = [
  'bob',
  'swayDegrees',
  'airStretch',
  'lift',
  'footStretch',
  'breatheDelayMs',
  'breathePeriodMs',
  'breatheAmount',
] as const;

export type WalkParamKey = (typeof WALK_PARAM_KEYS)[number];
export type RigParams = Partial<Record<WalkParamKey, number>>;

export interface RigDef {
  id: string;
  /** 圖片的原始大小；載入後會與實際貼圖核對。 */
  textureSize: { width: number; height: number };
  /** 腳的切線（圖片 y）：以下算「腳」。 */
  legTop: number;
  /** 各方向使用的素材 id。 */
  views: Record<RigView, string>;
  /**
   * 兩隻腳的分界 x（圖片 x）。朝右若是朝左的翻轉，就不要設定 right，由程式從 left 翻過來。
   */
  splits: { down: number; up: number; left: number; right?: number };
  /** 覆寫預設的走路參數。 */
  params?: RigParams;
}

export interface RigManifest {
  version: 1;
  rigs: RigDef[];
}

/**
 * rig 與素材清單的交叉檢查：每個方向的素材必須存在、是正式的角色圖（有檔案）；
 * 只有朝右可以是翻轉，而且必須翻轉的是朝左的素材；切線與分界要落在圖片範圍內。
 */
export function rigProblems(manifest: RigManifest, assets: AssetManifest): string[] {
  const problems: string[] = [];
  const byId = new Map<string, AssetEntry>(assets.assets.map((a) => [a.id, a]));
  const seen = new Set<string>();

  for (const rig of manifest.rigs) {
    if (seen.has(rig.id)) problems.push(`rig id 重複：${rig.id}`);
    seen.add(rig.id);

    const { width, height } = rig.textureSize;
    if (!(rig.legTop >= 1 && rig.legTop <= height - 1)) {
      problems.push(`rig ${rig.id} 的 legTop 必須在 1 到 ${height - 1} 之間：${rig.legTop}`);
    }
    for (const view of RIG_VIEWS) {
      const split = rig.splits[view];
      if (split !== undefined && !(split >= 1 && split <= width - 1)) {
        problems.push(`rig ${rig.id} 的 splits.${view} 必須在 1 到 ${width - 1} 之間：${split}`);
      }
    }

    for (const view of RIG_VIEWS) {
      const assetId = rig.views[view];
      const asset = byId.get(assetId);
      if (!asset) {
        problems.push(`rig ${rig.id} 的 ${view} 素材 ${assetId} 不存在`);
        continue;
      }
      if (asset.mirrorOf !== undefined) {
        if (view !== 'right') {
          problems.push(`rig ${rig.id} 的 ${view} 素材 ${assetId} 不能是翻轉素材（只有 right 可以）`);
          continue;
        }
        if (asset.mirrorOf !== rig.views.left) {
          problems.push(`rig ${rig.id} 的 right 素材 ${assetId} 翻轉的不是 left 的素材 ${rig.views.left}`);
        }
      }
      const real = asset.mirrorOf !== undefined ? byId.get(asset.mirrorOf) : asset;
      if (!real) continue; // 翻轉目標不存在：素材清單自己的檢查會報
      if (real.kind !== 'character') problems.push(`rig ${rig.id} 的 ${view} 素材 ${assetId} 必須是 character`);
      if (real.file === undefined) {
        problems.push(`rig ${rig.id} 的 ${view} 素材 ${assetId} 沒有檔案，rig 只能用正式素材`);
      }
    }

    const right = byId.get(rig.views.right);
    if (right !== undefined) {
      const mirrored = right.mirrorOf === rig.views.left;
      if (mirrored && rig.splits.right !== undefined) {
        problems.push(`rig ${rig.id} 的 right 由翻轉得到，不可設定 splits.right`);
      }
      if (right.mirrorOf === undefined && rig.splits.right === undefined) {
        problems.push(`rig ${rig.id} 的 right 不是 left 的翻轉，必須設定 splits.right`);
      }
    }
  }
  return problems;
}
