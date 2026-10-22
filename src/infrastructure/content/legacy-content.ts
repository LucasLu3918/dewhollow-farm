import type { ContentPack } from '../../domain/content';
import type { RatingRules } from '../../domain/rating';
import { normalizePlayerName } from '../../domain/legacy';

/**
 * 農場評級、豐收重置與傳承的內容檢查（M6）：權重加總為 1、門檻由高到低、最後一級是 0；
 * 豐收重置清掉的旗標要是店家賣的建築或合成效果；傳承要求的章節要存在；每種小屋格局都要有床邊的公告。
 */

export function ratingProblems(rating: RatingRules): string[] {
  const problems: string[] = [];
  const { income, collection, friendship } = rating.weights;
  const sum = income + collection + friendship;
  if (Math.abs(sum - 1) > 1e-9) problems.push(`農場評級的權重加總必須是 1，目前是 ${sum}`);
  if (!(rating.incomeFull > 0)) problems.push('農場評級的收入滿分門檻必須大於 0');

  const grades = rating.grades;
  if (grades.length === 0) problems.push('農場評級至少要有一級');
  for (let i = 1; i < grades.length; i += 1) {
    const upper = grades[i - 1];
    const lower = grades[i];
    if (upper && lower && !(upper.min > lower.min)) problems.push(`農場評級的門檻必須由高到低（${upper.grade} 之後是 ${lower.grade}）`);
  }
  const last = grades[grades.length - 1];
  if (last && last.min !== 0) problems.push('農場評級最後一級的門檻必須是 0');
  const letters = new Set(grades.map((g) => g.grade));
  if (letters.size !== grades.length) problems.push('農場評級的等級不能重複');
  return problems;
}

export function legacyProblems(pack: ContentPack): string[] {
  // 沒有 legacy.json 的測試用內容不檢查（沒有公告，玩家接觸不到，見 domain/legacy.ts 的 NO_LEGACY）。
  if (!pack.legacy) return [];
  const problems: string[] = [];
  const legacy = pack.legacy;

  if (normalizePlayerName(legacy.defaultPlayerName) === null) problems.push('傳承的預設名字必須是 1 至 8 個字');
  if (legacy.reset.fromYear < 2) problems.push('豐收重置要從第 2 年起（fromYear 不能小於 2）');

  const buildingFlags = new Set(
    pack.shops.flatMap((shop) => shop.stock.filter((line) => line.itemId.startsWith('building.')).map((line) => line.itemId.slice('building.'.length))),
  );
  const effectFlags = new Set(pack.crafting.flatMap((recipe) => (recipe.effect?.type === 'flag' ? [recipe.effect.flag] : [])));
  for (const flag of legacy.reset.resetFlags) {
    if (!buildingFlags.has(flag) && !effectFlags.has(flag)) problems.push(`豐收重置要清掉的旗標 ${flag} 不是店家的建築或合成效果`);
  }

  if (!(pack.chapters ?? []).some((chapter) => chapter.number === legacy.legacy.requiresChapter)) {
    problems.push(`傳承要求的主線第 ${legacy.legacy.requiresChapter} 章不存在`);
  }

  for (const map of pack.maps.filter((m) => m.id.startsWith('house'))) {
    const hasNotice = Object.values(map.legend).some((tile) => tile.notice === 'legacy');
    if (!hasNotice) problems.push(`小屋 ${map.id} 沒有床邊的傳承與重置公告（notice: legacy）`);
  }
  return problems;
}
