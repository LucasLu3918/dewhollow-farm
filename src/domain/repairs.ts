import type { Calendar, Season } from './calendar';

/**
 * 社區修復（M5d）：鎮廣場「修復委員會」的每季目標與捐獻規則。
 * 內容（名稱、候選物品、數量、獎勵旗標）在 content/repairs.json；這裡只做判斷，不寫死任何數字。
 * 紀錄分年：每年的捐獻從零開始；獎勵旗標一旦設定就保留（見 application/repairs.ts）。
 */

/**
 * 修復目標：候選清單裡不同的物品，每一種各捐到 each 件，共 count 種。
 * 春季是十種花與野菜各一件；夏季是八種不同的魚各一條（同一種魚捐再多也只算一種）。
 */
export type RepairGoal = { type: 'kinds'; pool: string[]; count: number; each: number };

export interface RepairReward {
  gold?: number;
  /** 完成時設定的旗標（解鎖配方、主線步驟等）。 */
  flags?: string[];
}

export interface RepairDef {
  id: string;
  season: Season;
  name: string;
  /** 告示上的請求文字。 */
  request: string;
  /** 完成時的文字。 */
  done: string;
  goal: RepairGoal;
  reward: RepairReward;
  /** 內容時數的估計（分鐘），見 docs/PLAYTIME_PLAN.md。 */
  playMinutes: number;
}

/** 一年中某項修復的捐獻紀錄（donated 是每個物品已捐的數量）。 */
export interface RepairRecord {
  year: number;
  donated: Record<string, number>;
  done: boolean;
}

/** 存檔裡的修復紀錄：鍵是修復的 id；沒有紀錄或年份不同都視為今年還沒捐過。 */
export type RepairState = Record<string, RepairRecord>;

export interface RepairProgress {
  value: number;
  target: number;
}

/** 這一年的紀錄（沒有或不是今年的，就是空的紀錄）。 */
export function recordOf(state: RepairState, id: string, year: number): RepairRecord {
  const record = state[id];
  return record && record.year === year ? record : { year, donated: {}, done: false };
}

/** 目標的進度：已達到的數量與目標數量。 */
export function goalProgress(goal: RepairGoal, donated: Record<string, number>): RepairProgress {
  const kinds = goal.pool.filter((itemId) => (donated[itemId] ?? 0) >= goal.each).length;
  return { value: Math.min(kinds, goal.count), target: goal.count };
}

export function goalMet(goal: RepairGoal, donated: Record<string, number>): boolean {
  const { value, target } = goalProgress(goal, donated);
  return value >= target;
}

/** 這一項物品還能再捐幾件（不在候選清單、或目標已經達到就是 0）。 */
export function donationCap(goal: RepairGoal, donated: Record<string, number>, itemId: string): number {
  if (!goal.pool.includes(itemId) || goalMet(goal, donated)) return 0;
  return Math.max(0, goal.each - (donated[itemId] ?? 0));
}

/**
 * 捐獻的拒絕原因（失敗代碼），或 null 表示可以捐。順序：已完成、不在候選、數量不對、超過上限。
 * 物品是否夠（背包）不在這裡判斷，由應用層決定。
 */
export function donationRefusal(def: RepairDef, record: RepairRecord, itemId: string, count: number): string | null {
  if (record.done) return 'REPAIR_DONE';
  if (!def.goal.pool.includes(itemId)) return 'NOT_REPAIR_ITEM';
  if (!Number.isInteger(count) || count < 1) return 'BAD_COUNT';
  if (count > donationCap(def.goal, record.donated, itemId)) return 'REPAIR_ENOUGH';
  return null;
}

/** 把捐獻記進紀錄（不檢查，呼叫前要先用 donationRefusal 檢查）。 */
export function recordDonation(record: RepairRecord, itemId: string, count: number): RepairRecord {
  return { ...record, donated: { ...record.donated, [itemId]: (record.donated[itemId] ?? 0) + count } };
}

/** 修復目標所屬的季節（只有這個季節能捐）。 */
export function seasonOpen(def: RepairDef, calendar: Calendar): boolean {
  return calendar.season === def.season;
}
