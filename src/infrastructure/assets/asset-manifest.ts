export type AssetKind = 'tile' | 'object' | 'overlay' | 'crop' | 'character';

export interface AssetEntry {
  id: string;
  kind: AssetKind;
  /** 占位色；沒有 file 時以此色繪製占位圖。 */
  color?: string;
  /** 正式素材的路徑（相對於 public/）。替換素材時只需改這裡。 */
  file?: string;
  /** 圖檔是設計尺寸的幾倍（2 代表 2x 母版）；顯示時自動縮小。只有 file 存在時才有意義。 */
  density?: number;
  /** 這張圖是另一個素材的水平翻轉（例如朝右 = 朝左的翻轉），不另存檔、也不另外載入。 */
  mirrorOf?: string;
  /** 素材來源，用於授權紀錄。 */
  source: string;
}

export interface AssetManifest {
  version: 1;
  assets: AssetEntry[];
  /** Optional production UI icons keyed by full item id (for example `item.sweet-radish`). */
  itemIcons?: Record<string, string>;
}

export type ItemIconResolution =
  | { status: 'available'; src: string }
  | { status: 'missing'; diagnostic: 'missing-icon' | 'unknown-item' };

/** 遊戲運行時需要的素材 id。地圖上的格子以 `tile.<kind>` 命名。 */
export function requiredAssetIds(tileKinds: readonly string[], cropIds: readonly string[], npcIds: readonly string[]): string[] {
  return [
    ...tileKinds.map((kind) => `tile.${kind}`),
    'tile.soil',
    ...cropIds.map((id) => `crop.${id}`),
    'player.up',
    'player.down',
    'player.left',
    'player.right',
    ...npcIds.map((id) => `npc.${id}`),
  ];
}

export function missingAssetIds(manifest: AssetManifest, required: readonly string[]): string[] {
  const known = new Set(manifest.assets.map((a) => a.id));
  return required.filter((id) => !known.has(id));
}

/** 顯示縮放：2x 母版以 0.5 倍顯示，才會是設計尺寸（64 px 格子的 64×80 角色）。 */
export function displayScale(entry: AssetEntry): number {
  return 1 / (entry.density ?? 1);
}

/**
 * 素材清單自身的問題（不含地圖與作物的交叉參照）：
 * 有檔案的素材必須填實際來源（ORIGINALITY.md）、density 只能搭配檔案、路徑必須在 assets/ 底下、id 不可重複；
 * 翻轉素材（mirrorOf）必須指向存在的、非翻轉的、同種類的素材，且不能自己帶 file 或 density。
 */
export function assetProblems(manifest: AssetManifest): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const byId = new Map(manifest.assets.map((a) => [a.id, a]));
  for (const entry of manifest.assets) {
    if (seen.has(entry.id)) problems.push(`素材 id 重複：${entry.id}`);
    seen.add(entry.id);

    if (entry.mirrorOf !== undefined) {
      problems.push(...mirrorProblems(entry, byId));
      continue;
    }
    if (!entry.file) {
      if (entry.density !== undefined) problems.push(`素材 ${entry.id} 設了 density 卻沒有 file`);
      continue;
    }
    if (entry.source.startsWith('占位')) {
      problems.push(`素材 ${entry.id} 有檔案但來源仍是占位，請填寫實際來源與授權`);
    }
    if (!entry.file.startsWith('assets/') || entry.file.includes('..')) {
      problems.push(`素材 ${entry.id} 的檔案路徑必須在 assets/ 底下：${entry.file}`);
    }
  }
  for (const [itemId, file] of Object.entries(manifest.itemIcons ?? {})) {
    if (!isValidInventoryItemId(itemId)) {
      problems.push(`物品圖示 id 格式無效：${itemId}`);
    }
    if (!isSafeItemIconFile(file)) {
      problems.push(`物品 ${itemId} 的圖示路徑必須在 assets/ 底下：${file}`);
    }
  }
  return problems;
}

/** Resolves an optional inventory icon. Unknown ids and known items without artwork stay explicit. */
export function resolveItemIcon(
  manifest: AssetManifest,
  itemId: string,
  knownItemIds: ReadonlySet<string>,
): ItemIconResolution {
  if (!knownItemIds.has(itemId)) return { status: 'missing', diagnostic: 'unknown-item' };
  const file = manifest.itemIcons?.[itemId];
  if (!file || !isSafeItemIconFile(file)) {
    return { status: 'missing', diagnostic: 'missing-icon' };
  }
  return { status: 'available', src: `/${file}` };
}

function isSafeItemIconFile(file: string): boolean {
  return /^assets\/items\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.png$/i.test(file);
}

function isValidInventoryItemId(itemId: string): boolean {
  return /^(?:(?:item|building|recipe|fish|crop|seed|animal|dish|decor)\.)?[a-z0-9]+(?:-[a-z0-9]+)*$/.test(itemId);
}

function mirrorProblems(entry: AssetEntry, byId: ReadonlyMap<string, AssetEntry>): string[] {
  const targetId = entry.mirrorOf as string;
  if (targetId === entry.id) return [`素材 ${entry.id} 不能翻轉自己`];
  const target = byId.get(targetId);
  if (!target) return [`素材 ${entry.id} 的 mirrorOf 指向不存在的素材 ${targetId}`];

  const problems: string[] = [];
  if (target.mirrorOf !== undefined) {
    problems.push(`素材 ${entry.id} 的 mirrorOf 指向另一個翻轉素材 ${targetId}，請直接指向原圖`);
  }
  if (entry.file !== undefined || entry.density !== undefined) {
    problems.push(`素材 ${entry.id} 設了 mirrorOf，就不能再有 file 或 density`);
  }
  if (entry.kind !== target.kind) {
    problems.push(`素材 ${entry.id} 的種類（${entry.kind}）必須與 ${targetId} 相同（${target.kind}）`);
  }
  if (target.file !== undefined && entry.source.startsWith('占位')) {
    problems.push(`素材 ${entry.id} 翻轉的是正式素材，來源不能是占位`);
  }
  return problems;
}

/** 畫面上實際要用的貼圖：一般素材是自己；翻轉素材是原圖的貼圖，加上水平翻轉與原圖的顯示縮放。 */
export function resolveAsset(
  manifest: AssetManifest,
  id: string,
): { textureId: string; flipX: boolean; scale: number } {
  const entry = manifest.assets.find((a) => a.id === id);
  if (!entry) throw new Error(`找不到素材：${id}`);
  if (entry.mirrorOf === undefined) return { textureId: entry.id, flipX: false, scale: displayScale(entry) };
  const target = manifest.assets.find((a) => a.id === entry.mirrorOf);
  if (!target) throw new Error(`找不到素材：${entry.mirrorOf}`);
  return { textureId: target.id, flipX: true, scale: displayScale(target) };
}

/** 宣告了檔案但 public/ 裡找不到的素材。`existing` 是 public/ 底下存在的檔案路徑。 */
export function missingFiles(manifest: AssetManifest, existing: ReadonlySet<string>): AssetEntry[] {
  return manifest.assets.filter((entry) => entry.file !== undefined && !existing.has(entry.file));
}
