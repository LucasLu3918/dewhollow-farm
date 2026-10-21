import type { Quality } from './items';
import type { ActionKind, SkillTuning } from './tuning';

/**
 * 技能與經驗：耕作、採集、釣魚、礦工、烹飪，各 10 級。
 * 經驗來自動作（數值在 content/tuning.json 的 skills.xp）；等級由經驗門檻決定；
 * 到了門檻的等級會有加成（額外一件產出），耕作的等級也會影響作物品質。
 */

export const SKILL_IDS = ['farming', 'foraging', 'fishing', 'mining', 'cooking'] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export const SKILL_NAMES: Record<SkillId, string> = {
  farming: '耕作',
  foraging: '採集',
  fishing: '釣魚',
  mining: '礦工',
  cooking: '烹飪',
};

export const MAX_LEVEL = 10;

export type SkillXp = Record<SkillId, number>;

export function emptySkills(): SkillXp {
  return { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 };
}

/** 經驗達到第 i 級門檻的等級（thresholds[0] 是第 0 級，最高到 MAX_LEVEL）。 */
export function levelOf(xp: number, thresholds: readonly number[]): number {
  let level = 0;
  for (let i = 1; i < thresholds.length && i <= MAX_LEVEL; i += 1) {
    if (xp >= (thresholds[i] ?? Number.POSITIVE_INFINITY)) level = i;
  }
  return level;
}

/** 這個動作練的是哪一項技能；沒有技能的動作（出貨）回傳 null。 */
export function skillOfAction(action: ActionKind): SkillId | null {
  switch (action) {
    case 'till':
    case 'water':
    case 'plant':
    case 'harvest':
      return 'farming';
    case 'chop':
    case 'forage':
      return 'foraging';
    case 'mine':
      return 'mining';
    case 'fish':
      return 'fishing';
    case 'cook':
    case 'process':
      return 'cooking';
    case 'ship':
      return null;
  }
}

/** 等級達到 bonusFrom 之後，採收與挖掘的產出多一件。 */
export function bonusYield(level: number, tuning: Pick<SkillTuning, 'bonusFrom'>): number {
  return level >= tuning.bonusFrom ? 1 : 0;
}

/**
 * 作物品質：r 是 0 到 1 之間的隨機數。耕作夠高才有機會出精良（fine），再來才是優良（good）。
 * 機率：r 小於 fineChance 就是精良（等級要到 fineFrom）；再小於 fineChance + goodChance 是優良（等級要到 goodFrom）。
 */
export function qualityFor(
  level: number,
  r: number,
  tuning: Pick<SkillTuning, 'goodFrom' | 'goodChance' | 'fineFrom' | 'fineChance'>,
): Quality {
  if (level >= tuning.fineFrom && r < tuning.fineChance) return 'fine';
  const goodLimit = level >= tuning.fineFrom ? tuning.fineChance + tuning.goodChance : tuning.goodChance;
  if (level >= tuning.goodFrom && r < goodLimit) return 'good';
  return 'normal';
}
