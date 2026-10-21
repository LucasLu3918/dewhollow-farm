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
  'hopHeight',
  'hopStretch',
  'breatheDelayMs',
  'breathePeriodMs',
  'breatheAmount',
] as const;

export type WalkParamKey = (typeof WALK_PARAM_KEYS)[number];
export type RigParams = Partial<Record<WalkParamKey, number>>;

interface RigBase {
  id: string;
  /** 圖片的原始大小；載入後會與實際貼圖核對。 */
  textureSize: { width: number; height: number };
  /** 覆寫預設的走路參數。 */
  params?: RigParams;
}

/** 四方向、上半身與腳分開動作的角色（玩家）。 */
export interface BipedRig extends RigBase {
  kind: 'biped';
  /** 腳的切線（圖片 y）：以下算「腳」。 */
  legTop: number;
  /** 各方向使用的素材 id。 */
  views: Record<RigView, string>;
  /**
   * 兩隻腳的分界 x（圖片 x）。朝右若是朝左的翻轉，就不要設定 right，由程式從 left 翻過來。
   */
  splits: { down: number; up: number; left: number; right?: number };
  /**
   * 握工具的位置（圖片像素）。沒有設定的角色不能揮工具。
   * 規則與 splits 相同：朝右若是朝左的翻轉，就不要設定 right，由程式翻過來。
   */
  hands?: { down: Point; up: Point; left: Point; right?: Point };
}

export interface Point {
  x: number;
  y: number;
}

/**
 * 只有一張圖、不分方向也不切開的角色：
 * `single` 走搖擺步（起伏、傾斜、拉長，例如毛毛），`hop` 走小跳步（寵物）。
 */
export interface WholeRig extends RigBase {
  kind: 'single' | 'hop';
  asset: string;
}

export type RigDef = BipedRig | WholeRig;

export interface RigManifest {
  version: 1;
  rigs: RigDef[];
}

/**
 * rig 與素材清單的交叉檢查。
 * - 四方向（biped）：每個方向的素材必須存在、是正式的角色圖（有檔案）；只有朝右可以是翻轉，
 *   而且必須翻轉朝左的素材；切線與分界要落在圖片範圍內。
 * - 單張圖（single、hop）：素材必須存在、是有檔案的角色圖。
 */
export function rigProblems(manifest: RigManifest, assets: AssetManifest): string[] {
  const problems: string[] = [];
  const byId = new Map<string, AssetEntry>(assets.assets.map((a) => [a.id, a]));
  const seen = new Set<string>();

  for (const rig of manifest.rigs) {
    if (seen.has(rig.id)) problems.push(`rig id 重複：${rig.id}`);
    seen.add(rig.id);
    if (rig.kind === 'biped') problems.push(...bipedProblems(rig, byId));
    else problems.push(...wholeProblems(rig, byId));
  }
  return problems;
}

/** 這個素材實際用的圖（翻轉素材看原圖）必須是有檔案的角色圖。回傳的是問題的後半句。 */
function realImageProblems(asset: AssetEntry, byId: ReadonlyMap<string, AssetEntry>): string[] {
  const real = asset.mirrorOf !== undefined ? byId.get(asset.mirrorOf) : asset;
  if (!real) return []; // 翻轉目標不存在：素材清單自己的檢查會報
  const problems: string[] = [];
  if (real.kind !== 'character') problems.push('必須是 character');
  if (real.file === undefined) problems.push('沒有檔案，rig 只能用正式素材');
  return problems;
}

function wholeProblems(rig: WholeRig, byId: ReadonlyMap<string, AssetEntry>): string[] {
  const asset = byId.get(rig.asset);
  if (!asset) return [`rig ${rig.id} 的素材 ${rig.asset} 不存在`];
  return realImageProblems(asset, byId).map((p) => `rig ${rig.id} 的素材 ${rig.asset} ${p}`);
}

function bipedProblems(rig: BipedRig, byId: ReadonlyMap<string, AssetEntry>): string[] {
  const problems: string[] = [];
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
    for (const p of realImageProblems(asset, byId)) problems.push(`rig ${rig.id} 的 ${view} 素材 ${assetId} ${p}`);
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
    if (rig.hands) {
      if (mirrored && rig.hands.right !== undefined) problems.push(`rig ${rig.id} 的 hands.right 由翻轉得到，不可設定`);
      if (right.mirrorOf === undefined && rig.hands.right === undefined) {
        problems.push(`rig ${rig.id} 的 right 不是 left 的翻轉，必須設定 hands.right`);
      }
    }
  }
  if (rig.hands) {
    for (const view of RIG_VIEWS) {
      const hand = rig.hands[view];
      if (hand && !(hand.x >= 0 && hand.x <= width && hand.y >= 0 && hand.y <= height)) {
        problems.push(`rig ${rig.id} 的 hands.${view} (${hand.x},${hand.y}) 必須在圖片 ${width}×${height} 之內`);
      }
    }
  }
  return problems;
}
