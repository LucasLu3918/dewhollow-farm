export type AssetKind = 'tile' | 'object' | 'overlay' | 'crop' | 'character';

export interface AssetEntry {
  id: string;
  kind: AssetKind;
  /** 占位色；沒有 file 時以此色繪製占位圖。 */
  color?: string;
  /** 正式素材的路徑（相對於 public/）。替換素材時只需改這裡。 */
  file?: string;
  /** 素材來源，用於授權紀錄。 */
  source: string;
}

export interface AssetManifest {
  version: 1;
  assets: AssetEntry[];
}

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
