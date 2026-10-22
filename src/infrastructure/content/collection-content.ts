import type { ContentPack } from '../../domain/content';
import { DEX_PERCENTS } from '../../domain/collection';
import { COUNTER_KEYS } from '../../domain/achievements';

/**
 * 圖鑑與成就的交叉參照檢查（M5d）：圖鑑的條目與獎勵物品要存在、門檻只能是 25／50／75／100；
 * 成就的計數器要是已知的事件、旗標要有來源（章節、修復、委託、合成、店家改建、節慶的參加旗標）、
 * 圖鑑條目數不能超過類別的種數。
 */

/** 所有可以放進圖鑑的物品 id（與 load-content 的 itemIdsOf 一致，再加上料理與動物）。 */
function dexItemIds(pack: ContentPack): Set<string> {
  return new Set([
    ...pack.items.map((i) => i.id),
    ...pack.crops.flatMap((c) => [`seed.${c.id}`, `crop.${c.id}`]),
    ...pack.fish.map((f) => `fish.${f.id}`),
    ...pack.recipes.map((r) => `dish.${r.id}`),
    ...pack.animals.map((a) => `animal.${a.id}`),
  ]);
}

export function collectionProblems(pack: ContentPack): string[] {
  const problems: string[] = [];
  const categories = pack.collection ?? [];
  const itemIds = dexItemIds(pack);
  const seen = new Set<string>();

  for (const category of categories) {
    const owner = `圖鑑 ${category.id}`;
    if (seen.has(category.id)) problems.push(`圖鑑類別 id 重複：${category.id}`);
    seen.add(category.id);
    const entries = new Set<string>();
    for (const entry of category.entries) {
      if (!itemIds.has(entry)) problems.push(`${owner} 的條目 ${entry} 不存在`);
      if (entries.has(entry)) problems.push(`${owner} 的條目 ${entry} 重複`);
      entries.add(entry);
    }
    const percents = new Set<number>();
    for (const reward of category.rewards) {
      if (!(DEX_PERCENTS as readonly number[]).includes(reward.percent)) {
        problems.push(`${owner} 的獎勵門檻 ${reward.percent} 不是 25／50／75／100`);
      }
      if (percents.has(reward.percent)) problems.push(`${owner} 的獎勵門檻 ${reward.percent} 重複`);
      percents.add(reward.percent);
      for (const itemId of Object.keys(reward.items ?? {})) {
        if (!itemIds.has(itemId)) problems.push(`${owner} 的獎勵物品 ${itemId} 不存在`);
      }
    }
  }
  return problems;
}

/** 成就可以依的旗標：章節、修復、委託的獎勵旗標，合成的效果與店家改建，以及每個節慶的參加旗標。 */
function knownFlagsOf(pack: ContentPack): Set<string> {
  const quests = pack.quests?.defs ?? [];
  return new Set<string>([
    ...(pack.chapters ?? []).flatMap((c) => (c.reward.flag ? [c.reward.flag] : [])),
    ...(pack.repairs ?? []).flatMap((r) => r.reward.flags ?? []),
    ...quests.flatMap((q) => (q.reward.flag ? [q.reward.flag] : [])),
    ...pack.crafting.flatMap((r) => (r.effect?.type === 'flag' ? [r.effect.flag] : [])),
    ...pack.shops.flatMap((s) => s.stock.filter((line) => line.itemId.startsWith('building.')).map((line) => line.itemId.slice('building.'.length))),
    ...(pack.festivals ?? []).map((f) => `attended:${f.id}`),
  ]);
}

export function achievementProblems(pack: ContentPack): string[] {
  const problems: string[] = [];
  const list = pack.achievements ?? [];
  const categories = new Map((pack.collection ?? []).map((c) => [c.id, c]));
  const flags = knownFlagsOf(pack);
  const counters = new Set<string>(COUNTER_KEYS);
  const seen = new Set<string>();

  for (const achievement of list) {
    const owner = `成就 ${achievement.id}`;
    if (seen.has(achievement.id)) problems.push(`成就 id 重複：${achievement.id}`);
    seen.add(achievement.id);
    if (achievement.phase !== 'spring' && achievement.phase !== 'summer') problems.push(`${owner} 不在春夏（目前只有春夏的成就）`);
    const condition = achievement.condition;
    switch (condition.type) {
      case 'counter':
        if (!counters.has(condition.key)) problems.push(`${owner} 的計數 ${condition.key} 不是已知的事件`);
        break;
      case 'flag':
        if (!flags.has(condition.flag)) problems.push(`${owner} 的旗標 ${condition.flag} 沒有任何來源`);
        break;
      case 'dex': {
        const category = categories.get(condition.category);
        if (!category) {
          problems.push(`${owner} 的圖鑑類別 ${condition.category} 不存在`);
        } else if (condition.count > category.entries.length) {
          problems.push(`${owner} 要的圖鑑條目 ${condition.count} 超過 ${condition.category} 的 ${category.entries.length} 種`);
        }
        break;
      }
      case 'hearts':
        break;
    }
    if ((achievement.reward.gold ?? 0) < 0) problems.push(`${owner} 的金幣獎勵為負`);
  }
  return problems;
}
