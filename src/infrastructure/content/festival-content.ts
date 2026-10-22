import type { ContentPack } from '../../domain/content';
import { CROWN_RECIPE } from '../../domain/festival';

/**
 * 節慶與主線的交叉參照檢查（見 domain/festival.ts、domain/story.ts）：
 * 地點、居民、物品、食譜、店家與旗標都要存在；節慶的告示與水池要在地圖上找得到。
 */

/** 旗標的來源（不是 talked:<居民> 的情況）：主線與委託以外，自己設定的旗標（修復的獎勵旗標另外從 repairs.json 讀）。 */
const STORY_OWN_FLAGS = ['done:till', 'done:ship'] as const;

export function festivalProblems(pack: ContentPack): string[] {
  const problems: string[] = [];
  const festivals = pack.festivals ?? [];
  const npcIds = new Set(pack.npcs.map((n) => n.id));
  const maps = new Map(pack.maps.map((m) => [m.id, m]));
  const shops = new Map(pack.shops.map((s) => [s.id, s]));
  const itemIds = new Set([
    ...pack.items.map((i) => i.id),
    ...pack.crops.flatMap((c) => [`seed.${c.id}`, `crop.${c.id}`]),
    ...pack.fish.map((f) => `fish.${f.id}`),
    ...pack.recipes.map((r) => `dish.${r.id}`),
    ...pack.animals.map((a) => `animal.${a.id}`),
  ]);
  const seen = new Set<string>();
  const dates = new Set<string>();
  const exchangeIds = new Set<string>();
  const recipeFlags = new Set(pack.crafting.flatMap((r) => (r.unlock && 'flag' in r.unlock ? [r.unlock.flag] : [])));

  for (const festival of festivals) {
    const owner = `節慶 ${festival.id}`;
    if (seen.has(festival.id)) problems.push(`節慶 id 重複：${festival.id}`);
    seen.add(festival.id);
    const date = `${festival.season}:${festival.day}`;
    if (dates.has(date)) problems.push(`${owner} 與其他節慶同一天（${date}）`);
    dates.add(date);

    const map = maps.get(festival.mapId);
    if (!map) {
      problems.push(`${owner} 的地點 ${festival.mapId} 不存在`);
      continue;
    }
    if (!Object.values(map.legend).some((tile) => tile.notice === 'festival')) {
      problems.push(`${owner} 的地點 ${festival.mapId} 沒有節慶告示（notice: festival）`);
    }
    for (const swap of festival.swaps ?? []) {
      if (!npcIds.has(swap.npcId)) problems.push(`${owner} 的交換居民 ${swap.npcId} 不存在`);
      for (const itemId of [swap.give.itemId, swap.receive.itemId]) {
        if (!itemIds.has(itemId)) problems.push(`${owner} 的交換物品 ${itemId} 不存在`);
      }
    }
    if (festival.swaps && new Set(festival.swaps.map((s) => s.npcId)).size !== festival.swaps.length) {
      problems.push(`${owner} 的種子交換有居民重複（每人只能換一次）`);
    }
    if (festival.crown && !pack.crafting.some((r) => r.id === CROWN_RECIPE)) {
      problems.push(`${owner} 的花冠製作需要合成配方 ${CROWN_RECIPE}`);
    }
    if (festival.stars) {
      if (!itemIds.has(festival.stars.itemId)) problems.push(`${owner} 的星星物品 ${festival.stars.itemId} 不存在`);
      if (!Object.values(map.legend).some((tile) => tile.festival === 'stars')) {
        problems.push(`${owner} 的地點 ${festival.mapId} 沒有星星水池（festival: stars）`);
      }
    }
    if (festival.shop !== undefined) {
      const shop = shops.get(festival.shop);
      if (!shop) problems.push(`${owner} 的攤位 ${festival.shop} 不存在`);
      else if (shop.festival !== festival.id) problems.push(`${owner} 的攤位 ${festival.shop} 沒有標記屬於這個節慶`);
    }
    for (const line of festival.exchange ?? []) {
      const lineOwner = `${owner} 的兌換 ${line.id}`;
      if (exchangeIds.has(line.id)) problems.push(`星河兌換 id 重複：${line.id}（紀錄是每年每項一次，id 要全域唯一）`);
      exchangeIds.add(line.id);
      for (const itemId of [line.give.itemId, line.receive?.itemId]) {
        if (itemId !== undefined && !itemIds.has(itemId)) problems.push(`${lineOwner} 的物品 ${itemId} 不存在`);
      }
      if (line.flag !== undefined && !recipeFlags.has(line.flag)) problems.push(`${lineOwner} 的旗標 ${line.flag} 沒有任何配方使用`);
    }
  }
  // 合成配方用旗標解鎖的，必須有星河兌換會設定它，否則永遠做不了。
  // 修復的獎勵旗標也能解鎖配方（例如春季修復給的噴泉圖紙）。
  const repairFlags = (pack.repairs ?? []).flatMap((r) => r.reward.flags ?? []);
  const exchangeFlags = new Set([...festivals.flatMap((f) => (f.exchange ?? []).flatMap((line) => (line.flag ? [line.flag] : []))), ...repairFlags]);
  for (const recipe of pack.crafting) {
    if (recipe.unlock && 'flag' in recipe.unlock && !exchangeFlags.has(recipe.unlock.flag)) {
      problems.push(`合成配方 ${recipe.id} 的解鎖旗標 ${recipe.unlock.flag} 沒有任何兌換來源（星河兌換或修復）`);
    }
  }

  for (const shop of pack.shops) {
    if (shop.festival === undefined) continue;
    if (!festivals.some((f) => f.id === shop.festival && f.shop === shop.id)) {
      problems.push(`商店 ${shop.id} 標記屬於節慶 ${shop.festival}，但節慶沒有指向它`);
    }
    for (const line of shop.stock) {
      if (line.limit === undefined) problems.push(`節慶攤位 ${shop.id} 的 ${line.itemId} 沒有數量限制（limit）`);
    }
  }
  return problems;
}

/**
 * 主線章節的交叉參照：章節號連續、步驟的旗標有來源、步驟的委託存在、獎勵物品存在。
 */
export function storyProblems(pack: ContentPack): string[] {
  const problems: string[] = [];
  const chapters = [...(pack.chapters ?? [])].sort((a, b) => a.number - b.number);
  const npcIds = new Set(pack.npcs.map((n) => n.id));
  const questIds = new Set((pack.quests?.defs ?? []).map((q) => q.id));
  const festivalIds = new Set((pack.festivals ?? []).map((f) => f.id));
  const itemIds = new Set([
    ...pack.items.map((i) => i.id),
    ...pack.crops.flatMap((c) => [`seed.${c.id}`, `crop.${c.id}`]),
    ...pack.fish.map((f) => `fish.${f.id}`),
  ]);
  const knownFlags = new Set<string>([
    ...STORY_OWN_FLAGS,
    ...(pack.repairs ?? []).flatMap((r) => r.reward.flags ?? []),
    ...pack.crafting.flatMap((r) => (r.effect?.type === 'flag' ? [r.effect.flag] : [])),
    ...pack.shops.flatMap((s) => s.stock.filter((line) => line.itemId.startsWith('building.')).map((line) => line.itemId.slice('building.'.length))),
    ...(pack.quests?.defs ?? []).flatMap((q) => (q.reward.flag ? [q.reward.flag] : [])),
    ...chapters.flatMap((c) => (c.reward.flag ? [c.reward.flag] : [])),
    ...[...festivalIds].map((id) => `attended:${id}`),
  ]);

  chapters.forEach((chapter, index) => {
    const owner = `主線第 ${chapter.number} 章`;
    if (chapter.number !== index + 1) problems.push(`${owner} 的章節號不連續（應為 ${index + 1}）`);
    for (const step of chapter.steps) {
      if ('quest' in step) {
        if (!questIds.has(step.quest)) problems.push(`${owner} 的步驟委託 ${step.quest} 不存在`);
        continue;
      }
      const flag = step.flag;
      if (flag.startsWith('talked:')) {
        const npc = flag.slice('talked:'.length);
        if (!npcIds.has(npc)) problems.push(`${owner} 的步驟居民 ${npc} 不存在`);
      } else if (!knownFlags.has(flag)) {
        problems.push(`${owner} 的步驟旗標 ${flag} 沒有任何來源`);
      }
    }
    for (const itemId of Object.keys(chapter.reward.items ?? {})) {
      if (!itemIds.has(itemId)) problems.push(`${owner} 的獎勵物品 ${itemId} 不存在`);
    }
  });
  return problems;
}
