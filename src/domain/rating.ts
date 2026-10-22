/**
 * 農場評級（M6）：依年度收入、圖鑑完成率、居民好感三項計分，得到 S、A、B、C。
 * 權重、收入的滿分門檻與評級門檻在 content/rating.json；這裡只做計算，不寫死任何數字。
 */

export type Grade = 'S' | 'A' | 'B' | 'C';

export interface RatingRules {
  weights: { income: number; collection: number; friendship: number };
  /** 本年收入達到這個金額就算收入項滿分（超過也只算 1）。 */
  incomeFull: number;
  /** 由高到低；總分 ≥ min 就是該級。 */
  grades: { grade: Grade; min: number }[];
}

export interface RatingInput {
  yearlyIncome: number;
  /** 圖鑑完成率 0–1。 */
  collectionRatio: number;
  /** 好感比例 0–1（居民點數的平均除以滿點）。 */
  friendshipRatio: number;
}

export interface RatingResult {
  /** 總分 0–1。 */
  score: number;
  grade: Grade;
  /** 三項各自的比例（0–1，已限制在範圍內）。 */
  parts: { income: number; collection: number; friendship: number };
}

/** 測試用的最小內容沒有 rating.json 時的替代值（只有一級，不影響任何判斷）。正式內容一律以 content/rating.json 為準。 */
export const NO_RATING: RatingRules = {
  weights: { income: 1, collection: 0, friendship: 0 },
  incomeFull: 1,
  grades: [{ grade: 'C', min: 0 }],
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function ratingOf(input: RatingInput, rules: RatingRules): RatingResult {
  const parts = {
    income: rules.incomeFull > 0 ? clamp01(input.yearlyIncome / rules.incomeFull) : 0,
    collection: clamp01(input.collectionRatio),
    friendship: clamp01(input.friendshipRatio),
  };
  const score = clamp01(
    parts.income * rules.weights.income + parts.collection * rules.weights.collection + parts.friendship * rules.weights.friendship,
  );
  const sorted = [...rules.grades].sort((a, b) => b.min - a.min);
  const grade = sorted.find((g) => score >= g.min)?.grade ?? sorted[sorted.length - 1]?.grade ?? 'C';
  return { score, grade, parts };
}

/** 圖鑑完成率：已發現的條目數除以全部條目數（跨類別合計）；沒有條目時是 0。 */
export function collectionRatio(categories: readonly { entries: readonly string[] }[], found: readonly string[]): number {
  const total = categories.reduce((sum, category) => sum + category.entries.length, 0);
  if (total === 0) return 0;
  const known = new Set(found);
  const done = categories.reduce((sum, category) => sum + category.entries.filter((id) => known.has(id)).length, 0);
  return done / total;
}

/** 好感比例：居民點數的平均除以滿點（maxPoints = 最多幾顆心 × 每顆心的點數）；沒有紀錄的居民算 0 點。 */
export function friendshipRatio(
  npcIds: readonly string[],
  friendship: Readonly<Record<string, { points: number } | undefined>>,
  maxPoints: number,
): number {
  if (npcIds.length === 0 || maxPoints <= 0) return 0;
  const sum = npcIds.reduce((total, id) => total + (friendship[id]?.points ?? 0), 0);
  return clamp01(sum / npcIds.length / maxPoints);
}
