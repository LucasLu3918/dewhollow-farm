import type { ContentPack, CropDef, MapDef, NpcDef } from '../domain/content';
import type { Tuning } from '../domain/tuning';

/**
 * 以 id 快速查找內容。假設內容已由基礎設施層驗證過參照完整性；
 * 查不到時代表程式或資料有缺陷，直接拋出錯誤，避免靜默錯誤。
 */
export interface ContentIndex {
  crop(id: string): CropDef;
  npc(id: string): NpcDef;
  map(id: string): MapDef;
  cropIds(): string[];
  tuning: Tuning;
}

export function createContentIndex(pack: ContentPack): ContentIndex {
  const crops = new Map(pack.crops.map((c) => [c.id, c]));
  const npcs = new Map(pack.npcs.map((n) => [n.id, n]));
  const maps = new Map(pack.maps.map((m) => [m.id, m]));

  return {
    crop(id) {
      const found = crops.get(id);
      if (!found) throw new Error(`找不到作物：${id}`);
      return found;
    },
    npc(id) {
      const found = npcs.get(id);
      if (!found) throw new Error(`找不到 NPC：${id}`);
      return found;
    },
    map(id) {
      const found = maps.get(id);
      if (!found) throw new Error(`找不到地圖：${id}`);
      return found;
    },
    cropIds() {
      return pack.crops.map((c) => c.id);
    },
    tuning: pack.tuning,
  };
}
