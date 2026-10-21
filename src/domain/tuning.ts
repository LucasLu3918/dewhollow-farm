/** 可調整的數值（體力、耗時、睡眠時間）。由 content/tuning.json 提供，不寫死在規則中。 */

export type ActionKind = 'till' | 'water' | 'plant' | 'harvest' | 'ship' | 'chop' | 'forage' | 'mine' | 'fish' | 'cook' | 'process';

export const ACTION_KINDS: readonly ActionKind[] = ['till', 'water', 'plant', 'harvest', 'ship', 'chop', 'forage', 'mine', 'fish', 'cook', 'process'];

/** 技能的調校：經驗門檻、各動作得到的經驗、加成與品質機率。 */
export interface SkillTuning {
  /** 各等級需要的經驗，索引即等級（第 0 級的門檻是 0）。 */
  thresholds: number[];
  /** 每次成功的動作得到的經驗；沒列出的動作不給經驗。 */
  xp: Partial<Record<ActionKind, number>>;
  /** 從這個等級起，採收與挖掘多一件。 */
  bonusFrom: number;
  goodFrom: number;
  goodChance: number;
  fineFrom: number;
  fineChance: number;
}

export interface Tuning {
  energy: {
    max: number;
    /** 每個動作消耗的體力。 */
    costs: Record<ActionKind, number>;
  };
  inventory: {
    /** 背包格數。 */
    capacity: number;
  };
  harvest: {
    /** 每次收穫隨機產出的數量範圍（含兩端）。 */
    min: number;
    max: number;
  };
  tools: {
    /** 每個階級的體力折扣，索引即階級（0 基礎、1 銅、2 銀、3 金）。 */
    tiers: { energyDiscount: number }[];
  };
  /** 採集的數量範圍（含兩端）。 */
  skills: SkillTuning;
  fishing: {
    /** 投竿後有魚上鉤的機率（百分比，0 到 100）。 */
    biteChance: number;
    /** 有浮標時加的上鉤機率（百分點）。 */
    bobberBonus: number;
    /** 用掉一個魚餌時加的上鉤機率（百分點）。 */
    baitBonus: number;
  };
  /** 肥料對收成品質的加成（百分點）：加在良品與精品的機率上。 */
  fertilizer: Record<'basic' | 'fine', { goodBonus: number; fineBonus: number }>;
  processing: {
    /** 加工機同時能加工的批數。 */
    slots: number;
  };
  gathering: {
    wood: { min: number; max: number };
    forage: { min: number; max: number };
    stone: { min: number; max: number };
    ore: { min: number; max: number };
  };
  time: {
    /** 睡醒時間，以一天中的分鐘數表示（例如 360 代表 06:00）。 */
    wakeMinute: number;
    /** 每個有效動作花費的分鐘數。 */
    minutesPerAction: number;
    /** 每個季節的天數（一年為四季）。 */
    daysPerSeason: number;
  };
}
