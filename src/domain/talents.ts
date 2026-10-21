/**
 * 技能天賦：技能到了 unlockLevel 級，從該技能的兩個天賦裡選一個，每項技能只能選一次。
 * 天賦只改產出、售價與料理的回復數值，不改任何動作的體力成本（見 docs/PLAYTIME_PLAN.md 第 3 節 K）。
 * 天賦的定義在 content/talents.json；這裡只放純規則。
 */
import type { ItemKind } from './items';
import type { Roll } from './random';
import { rollInt } from './random';
import type { SkillId } from './skills';

/** 天賦的效果。只有這幾種，每一種都在應用層的對應動作裡套用。 */
export type TalentEffect =
  /** 動作多得一件的機率（0 到 1）；item 有填時只對這種物品生效。 */
  | { type: 'extraYield'; action: 'harvest' | 'forage' | 'chop' | 'mine'; chance: number; item?: string }
  /** 指定種類的物品出貨時，售價加上百分比。 */
  | { type: 'sellBonus'; kinds: ItemKind[]; percent: number }
  /** 投竿後上鉤的機率加上幾個百分點。 */
  | { type: 'biteBonus'; points: number }
  /** 吃料理時多回復的體力。 */
  | { type: 'dishEnergy'; amount: number };

export interface TalentDef {
  id: string;
  skill: SkillId;
  name: string;
  description: string;
  effect: TalentEffect;
}

/** 天賦表：到哪一級可以選，以及所有天賦。 */
export interface TalentSet {
  unlockLevel: number;
  defs: TalentDef[];
}

/** 每項技能已選的天賦 id；沒選過的技能沒有這個欄位。 */
export type TalentChoices = Partial<Record<SkillId, string>>;

/** 已選的天賦的定義（找不到定義的選擇會被忽略）。 */
function chosenDefs(choices: TalentChoices, defs: readonly TalentDef[]): TalentDef[] {
  const found: TalentDef[] = [];
  for (const def of defs) {
    if (choices[def.skill] === def.id) found.push(def);
  }
  return found;
}

/**
 * 某個動作（與物品）多得一件的機率，是所有已選天賦的加總。
 * 沒有任何符合的天賦時回傳 0。
 */
export function extraYieldChance(choices: TalentChoices, defs: readonly TalentDef[], action: 'harvest' | 'forage' | 'chop' | 'mine', item?: string): number {
  let total = 0;
  for (const def of chosenDefs(choices, defs)) {
    const effect = def.effect;
    if (effect.type !== 'extraYield' || effect.action !== action) continue;
    if (effect.item !== undefined && effect.item !== item) continue;
    total += effect.chance;
  }
  return total;
}

/**
 * 擲一次多得一件的機率。機率為 0 時完全不抽隨機數，讓沒有天賦的存檔維持原本的隨機數序列。
 */
export function rollExtraYield(rng: number, chance: number): Roll {
  if (chance <= 0) return { value: 0, rng };
  const roll = rollInt(rng, 0, 999);
  return { value: roll.value < chance * 1000 ? 1 : 0, rng: roll.rng };
}

/** 某種物品的出貨售價加成（百分比），是所有符合種類的已選天賦加總。 */
export function sellBonusPercent(choices: TalentChoices, defs: readonly TalentDef[], kind: ItemKind): number {
  let total = 0;
  for (const def of chosenDefs(choices, defs)) {
    const effect = def.effect;
    if (effect.type === 'sellBonus' && effect.kinds.includes(kind)) total += effect.percent;
  }
  return total;
}

/** 價格加上百分比，四捨五入到整數（與品質倍率的做法相同）。 */
export function applySellBonus(price: number, percent: number): number {
  return Math.round((price * (100 + percent)) / 100);
}

/** 投竿上鉤機率的加成（百分點）。 */
export function biteBonusPoints(choices: TalentChoices, defs: readonly TalentDef[]): number {
  let total = 0;
  for (const def of chosenDefs(choices, defs)) {
    if (def.effect.type === 'biteBonus') total += def.effect.points;
  }
  return total;
}

/** 吃料理多回復的體力。 */
export function dishEnergyBonus(choices: TalentChoices, defs: readonly TalentDef[]): number {
  let total = 0;
  for (const def of chosenDefs(choices, defs)) {
    if (def.effect.type === 'dishEnergy') total += def.effect.amount;
  }
  return total;
}
