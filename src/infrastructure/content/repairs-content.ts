import type { ContentPack } from '../../domain/content';
import { isWalkable, tileAt } from '../../domain/world';

/**
 * 社區修復與隨機事件的交叉參照檢查（見 domain/repairs.ts、domain/random-events.ts）：
 * 候選與獎勵的物品要存在、修復的季節要在春夏（目前的內容範圍）、音樂會的居民與位置要存在且可走。
 */

/** 所有可以放進背包的物品 id（與 festival-content.ts 的算法一致）。 */
function itemIdsOf(pack: ContentPack): Set<string> {
  return new Set([
    ...pack.items.map((i) => i.id),
    ...pack.crops.flatMap((c) => [`seed.${c.id}`, `crop.${c.id}`]),
    ...pack.fish.map((f) => `fish.${f.id}`),
    ...pack.recipes.map((r) => `dish.${r.id}`),
    ...pack.animals.map((a) => `animal.${a.id}`),
  ]);
}

export function repairProblems(pack: ContentPack): string[] {
  const problems: string[] = [];
  const repairs = pack.repairs ?? [];
  const itemIds = itemIdsOf(pack);
  const seen = new Set<string>();

  for (const repair of repairs) {
    const owner = `修復 ${repair.id}`;
    if (seen.has(repair.id)) problems.push(`修復 id 重複：${repair.id}`);
    seen.add(repair.id);
    if (repair.season !== 'spring' && repair.season !== 'summer') problems.push(`${owner} 不在春夏（目前只有春夏的修復）`);
    for (const itemId of repair.goal.pool) {
      if (!itemIds.has(itemId)) problems.push(`${owner} 的候選物品 ${itemId} 不存在`);
    }
    const distinct = new Set(repair.goal.pool).size;
    if (repair.goal.count > distinct) {
      problems.push(`${owner} 要的種類 ${repair.goal.count} 比候選 ${distinct} 種還多`);
    }
  }
  return problems;
}

export function randomEventProblems(pack: ContentPack): string[] {
  const problems: string[] = [];
  const rules = pack.randomEvents;
  if (!rules) return problems;
  const itemIds = itemIdsOf(pack);
  const npcIds = new Set(pack.npcs.map((n) => n.id));
  const maps = new Map(pack.maps.map((m) => [m.id, m]));
  const seen = new Set<string>();

  for (const event of rules.events) {
    const owner = `隨機事件 ${event.id}`;
    if (seen.has(event.id)) problems.push(`隨機事件 id 重複：${event.id}`);
    seen.add(event.id);
    if (event.effect.type === 'grant') {
      for (const itemId of Object.keys(event.effect.items)) {
        if (!itemIds.has(itemId)) problems.push(`${owner} 的獎勵物品 ${itemId} 不存在`);
      }
    }
    if (event.effect.type === 'concert') {
      const map = maps.get(event.effect.mapId);
      if (!map) {
        problems.push(`${owner} 的音樂會地點 ${event.effect.mapId} 不存在`);
        continue;
      }
      const taken = new Set<string>();
      for (const spot of event.effect.spots) {
        if (!npcIds.has(spot.npcId)) problems.push(`音樂會的居民 ${spot.npcId} 不存在`);
        const key = `${spot.x},${spot.y}`;
        if (taken.has(key)) problems.push(`音樂會的位置 (${key}) 重複`);
        taken.add(key);
        const tile = tileAt(map, spot.x, spot.y);
        if (!tile || !isWalkable(tile.kind) || tile.kind === 'door') problems.push(`音樂會 (${key}) 不可行走`);
      }
    }
  }
  return problems;
}
