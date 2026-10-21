import type { SkillTuning } from './tuning';

export type Fertilizer = 'basic' | 'fine';

/**
 * 施了肥的田：收成品質的機率加上肥料的加成（內容的百分點換成機率）。
 * 沒有肥料時原樣回傳。
 */
export function fertilizedSkillTuning(
  tuning: SkillTuning,
  fertilizer: Fertilizer | undefined,
  table: Record<Fertilizer, { goodBonus: number; fineBonus: number }>,
): SkillTuning {
  if (!fertilizer) return tuning;
  const bonus = table[fertilizer];
  return {
    ...tuning,
    goodChance: tuning.goodChance + bonus.goodBonus / 100,
    fineChance: tuning.fineChance + bonus.fineBonus / 100,
  };
}
