import type { Season } from './calendar';

/**
 * 成就（M5d）：春夏可達的 20 個，多數是既有動作的里程碑。條件只看計數器、旗標、圖鑑與好感，
 * 不另外計時。每個成就只給一次（記在 unlocked 裡）。內容在 content/achievements.json。
 */

/** 計數器的鍵：由指令的事件推進（見 application/collection.ts）。 */
export const COUNTER_KEYS = ['harvest', 'ship', 'gift', 'quest', 'craft'] as const;
export type CounterKey = (typeof COUNTER_KEYS)[number];

export type AchievementCondition =
  /** 計數器達到 min。 */
  | { type: 'counter'; key: string; min: number }
  /** 旗標為真（例如萌芽祭參加過、修復完成、主線章節完成）。 */
  | { type: 'flag'; flag: string }
  /** 某一類圖鑑已發現的條目數達到 count。 */
  | { type: 'dex'; category: string; count: number }
  /** 好感：scope any 是任一位居民到 min 顆心；all 是每一位居民都到。 */
  | { type: 'hearts'; min: number; scope: 'any' | 'all' };

export interface AchievementReward {
  gold?: number;
  /** 稱號（記在稱號清單裡，成就面板顯示）。 */
  title?: string;
}

export interface AchievementDef {
  id: string;
  name: string;
  /** 面板上寫的達成條件（給玩家看）。 */
  description: string;
  condition: AchievementCondition;
  reward: AchievementReward;
  phase: Season;
  /** 內容時數的估計（分鐘），見 docs/PLAYTIME_PLAN.md。 */
  playMinutes: number;
}

/** 成就的存檔紀錄：已達成的成就 id、計數器、稱號（依達成順序）。 */
export interface AchievementState {
  unlocked: string[];
  counters: Record<string, number>;
  titles: string[];
}

export function emptyAchievements(): AchievementState {
  return { unlocked: [], counters: {}, titles: [] };
}

/** 條件判斷要看的狀態（由應用層從遊戲狀態組出來）。 */
export interface AchievementContext {
  counters: Readonly<Record<string, number>>;
  flags: Readonly<Record<string, boolean>>;
  /** 某一類圖鑑已發現的條目數。 */
  dexCount: (category: string) => number;
  /** 某位居民的顆心數。 */
  hearts: (npcId: string) => number;
  /** 所有居民的 id（好感 all 要看全部）。 */
  residents: readonly string[];
}

export function conditionMet(condition: AchievementCondition, ctx: AchievementContext): boolean {
  switch (condition.type) {
    case 'counter':
      return (ctx.counters[condition.key] ?? 0) >= condition.min;
    case 'flag':
      return ctx.flags[condition.flag] === true;
    case 'dex':
      return ctx.dexCount(condition.category) >= condition.count;
    case 'hearts': {
      const reached = (npcId: string) => ctx.hearts(npcId) >= condition.min;
      if (condition.scope === 'all') return ctx.residents.length > 0 && ctx.residents.every(reached);
      return ctx.residents.some(reached);
    }
  }
}

/** 條件達成、而且還沒達成過的成就（依內容的順序）。 */
export function newlyUnlocked(defs: readonly AchievementDef[], state: AchievementState, ctx: AchievementContext): AchievementDef[] {
  const done = new Set(state.unlocked);
  return defs.filter((def) => !done.has(def.id) && conditionMet(def.condition, ctx));
}

/** 標記成就達成；稱號獎勵記進稱號清單。 */
export function markUnlocked(state: AchievementState, def: AchievementDef): AchievementState {
  return {
    ...state,
    unlocked: [...state.unlocked, def.id],
    titles: def.reward.title ? [...state.titles, def.reward.title] : state.titles,
  };
}

/** 計數器加 by（只增加）。 */
export function bumpCounter(state: AchievementState, key: string, by: number): AchievementState {
  if (by <= 0) return state;
  return { ...state, counters: { ...state.counters, [key]: (state.counters[key] ?? 0) + by } };
}
