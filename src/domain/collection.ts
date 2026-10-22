import type { Season } from './calendar';

/**
 * 圖鑑（M5d）：每一類的已發現條目，以及 25／50／75／100% 的門檻獎勵。
 * 條目是物品 id（fish.carp、crop.dew-grass、animal.chicken…），首次取得才計入（見 application/collection.ts）。
 * 類別與獎勵的內容在 content/collection.json；這裡只做判斷，不寫死任何數字。
 */

/** 門檻（百分比）：每一類依這四個門檻給獎勵。 */
export const DEX_PERCENTS = [25, 50, 75, 100] as const;

export interface DexReward {
  /** 25、50、75 或 100。 */
  percent: number;
  gold?: number;
  /** 裝飾或其他物品（放不下背包就等騰出空間後再給）。 */
  items?: Record<string, number>;
  /** 稱號（記在成就的稱號清單裡）。 */
  title?: string;
}

export interface DexCategory {
  id: string;
  name: string;
  /** 內容時數用的季節（見 PLAYTIME_PLAN）。 */
  phase: Season;
  /** 內容時數的估計（分鐘）。 */
  playMinutes: number;
  /** 這一類的所有條目（物品 id）。 */
  entries: string[];
  rewards: DexReward[];
}

/** 圖鑑的存檔紀錄：已發現的條目（依發現順序）與已領過的獎勵（`類別:門檻`）。 */
export interface CollectionState {
  found: string[];
  claimed: string[];
}

export function emptyCollection(): CollectionState {
  return { found: [], claimed: [] };
}

/** 把新取得的條目記進圖鑑；已經發現過的不重複計。沒有新條目時回傳同一個狀態。 */
export function discoverEntries(state: CollectionState, ids: readonly string[]): CollectionState {
  const known = new Set(state.found);
  const fresh = [...new Set(ids)].filter((id) => !known.has(id));
  if (fresh.length === 0) return state;
  return { ...state, found: [...state.found, ...fresh] };
}

/** 一類裡已發現的條目數。 */
export function categoryCount(category: DexCategory, found: readonly string[]): number {
  const known = new Set(found);
  return category.entries.filter((id) => known.has(id)).length;
}

/** 門檻需要的條目數（向上取整）：例如 5 種的 25% 是 2 種。 */
export function thresholdOf(total: number, percent: number): number {
  return Math.ceil((total * percent) / 100);
}

export function claimKey(categoryId: string, percent: number): string {
  return `${categoryId}:${percent}`;
}

/** 已達到門檻、還沒領過的獎勵（依門檻由小到大）。 */
export function dueRewards(category: DexCategory, found: readonly string[], claimed: readonly string[]): DexReward[] {
  const count = categoryCount(category, found);
  const done = new Set(claimed);
  return [...category.rewards]
    .sort((a, b) => a.percent - b.percent)
    .filter((reward) => count >= thresholdOf(category.entries.length, reward.percent) && !done.has(claimKey(category.id, reward.percent)));
}

/** 標記為已領過（不檢查獎勵是否真的給了，由呼叫端決定）。 */
export function markClaimed(state: CollectionState, keys: readonly string[]): CollectionState {
  if (keys.length === 0) return state;
  return { ...state, claimed: [...state.claimed, ...keys] };
}
