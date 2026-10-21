import type { Season } from './calendar';
import type { BulletinRules } from './bulletin';

/**
 * 委託（M5b）：居民委託與佈告欄委託的規則。內容（文字、數值、條件）在 content/quests.json；這裡只做判斷。
 * - resident：居民委託，條件符合後開放，只能接一次。
 * - daily、weekly：佈告欄的委託，每天抽、每週抽一件大委託；做完之後還能再接。
 * 進度由遊戲事件推進（收成、出貨、釣魚、烹飪、拜訪、挖礦），好感與交付則看目前狀態。
 */

export type QuestKind = 'resident' | 'daily' | 'weekly';

export type QuestGoal =
  /** 交付物品：完成時從背包拿走（見應用層 submitQuest）。 */
  | { type: 'deliver'; itemId: string; count: number }
  /** 收成 N 種不同的作物。 */
  | { type: 'harvestKinds'; count: number }
  /** 出貨 N 件（累計）。 */
  | { type: 'ship'; count: number }
  /** 與某位居民達到 N 顆心（看目前的好感）。 */
  | { type: 'hearts'; npcId: string; hearts: number }
  /** 拜訪某張地圖。 */
  | { type: 'visit'; mapId: string }
  /** 釣到某種魚 N 條。 */
  | { type: 'fish'; fishId: string; count: number }
  /** 挖到某一層（進到該層或更深）。 */
  | { type: 'mineLayer'; layer: number }
  /** 烹飪某道料理 N 份。 */
  | { type: 'cook'; recipeId: string; count: number };

/** 委託的開放條件（全部符合才開放）；沒有條件就一開始就開放。 */
export interface QuestUnlock {
  hearts?: { npcId: string; hearts: number };
  /** 遊戲旗標為真。 */
  flag?: string;
  /** 這個心形事件已經觸發過。 */
  heartEvent?: string;
  /** 這封信已經讀過。 */
  letter?: string;
}

export interface QuestReward {
  gold?: number;
  items?: Record<string, number>;
  /** 給委託人的好感點數（佈告欄的委託沒有委託人，省略）。 */
  friendship?: number;
  /** 完成時記錄的旗標。 */
  flag?: string;
  /** 圖鑑碎片的數量（圖鑑本身在 M5d 才做）。 */
  fragments?: number;
}

export interface QuestDef {
  id: string;
  kind: QuestKind;
  title: string;
  /** 委託人（居民 id）；佈告欄的委託沒有。 */
  giver?: string;
  /** 委託人的請求（或佈告欄上的告示文字）。 */
  request: string;
  /** 完成後的感謝。 */
  thanks: string;
  goal: QuestGoal;
  unlock?: QuestUnlock;
  reward: QuestReward;
  /** 這件委託屬於哪一季（用於時數統計）。 */
  phase: Season;
  /** 內容時數的估計（分鐘），見 docs/PLAYTIME_PLAN.md。 */
  playMinutes: number;
}

/** 內容裡的委託：所有委託定義，加上佈告欄的抽取規則。 */
export interface QuestSet {
  defs: QuestDef[];
  bulletin: BulletinRules;
}

export type QuestStatus = 'active' | 'done';

/** 一件委託在存檔裡的紀錄。沒有紀錄代表還沒接過。 */
export interface QuestRecord {
  status: QuestStatus;
  /** 數量型目標的累計（出貨件數、釣魚條數、烹飪份數、挖到的最深層，或拜訪的 1）。 */
  progress: number;
  /** 收成過的作物種類（收成 N 種用）。 */
  seen: string[];
}

export const NOT_STARTED: QuestRecord = { status: 'active', progress: 0, seen: [] };

/** 會推進委託進度的遊戲事件。 */
export type QuestEvent =
  | { type: 'harvest'; cropId: string }
  | { type: 'ship'; itemId: string; count: number }
  | { type: 'fish'; fishId: string }
  | { type: 'cook'; recipeId: string }
  | { type: 'visit'; mapId: string }
  | { type: 'mineLayer'; layer: number };

export interface GoalContext {
  hearts(npcId: string): number;
  itemCount(itemId: string): number;
}

export interface UnlockContext {
  hearts(npcId: string): number;
  flags: Readonly<Record<string, boolean>>;
  heartEvents: readonly string[];
  mail: Readonly<Record<string, 'unread' | 'read'>>;
}

export interface Progress {
  value: number;
  target: number;
}

export function isRepeatable(def: Pick<QuestDef, 'kind'>): boolean {
  return def.kind !== 'resident';
}

/** 目標的進度（已達到的數量與目標數量）。 */
export function goalProgress(goal: QuestGoal, record: QuestRecord, ctx: GoalContext): Progress {
  switch (goal.type) {
    case 'deliver':
      return { value: Math.min(ctx.itemCount(goal.itemId), goal.count), target: goal.count };
    case 'harvestKinds':
      return { value: Math.min(record.seen.length, goal.count), target: goal.count };
    case 'ship':
    case 'fish':
    case 'cook':
      return { value: Math.min(record.progress, goal.count), target: goal.count };
    case 'hearts':
      return { value: Math.min(ctx.hearts(goal.npcId), goal.hearts), target: goal.hearts };
    case 'visit':
      return { value: Math.min(record.progress, 1), target: 1 };
    case 'mineLayer':
      return { value: Math.min(record.progress, goal.layer), target: goal.layer };
  }
}

export function goalMet(goal: QuestGoal, record: QuestRecord, ctx: GoalContext): boolean {
  const { value, target } = goalProgress(goal, record, ctx);
  return value >= target;
}

/**
 * 事件推進目標：符合的事件才改變紀錄；不符合時回傳同一個物件（呼叫端可以用 === 判斷有沒有變）。
 */
export function advanceQuest(goal: QuestGoal, record: QuestRecord, event: QuestEvent): QuestRecord {
  switch (goal.type) {
    case 'harvestKinds': {
      if (event.type !== 'harvest' || record.seen.includes(event.cropId)) return record;
      return { ...record, seen: [...record.seen, event.cropId], progress: record.seen.length + 1 };
    }
    case 'ship':
      if (event.type !== 'ship') return record;
      return { ...record, progress: record.progress + event.count };
    case 'fish':
      if (event.type !== 'fish' || event.fishId !== goal.fishId) return record;
      return { ...record, progress: record.progress + 1 };
    case 'cook':
      if (event.type !== 'cook' || event.recipeId !== goal.recipeId) return record;
      return { ...record, progress: record.progress + 1 };
    case 'visit':
      if (event.type !== 'visit' || event.mapId !== goal.mapId || record.progress >= 1) return record;
      return { ...record, progress: 1 };
    case 'mineLayer':
      if (event.type !== 'mineLayer' || event.layer <= record.progress) return record;
      return { ...record, progress: event.layer };
    case 'deliver':
    case 'hearts':
      return record;
  }
}

/** 解鎖條件是否全部符合。 */
export function unlockMet(unlock: QuestUnlock | undefined, ctx: UnlockContext): boolean {
  if (!unlock) return true;
  if (unlock.hearts && ctx.hearts(unlock.hearts.npcId) < unlock.hearts.hearts) return false;
  if (unlock.flag !== undefined && ctx.flags[unlock.flag] !== true) return false;
  if (unlock.heartEvent !== undefined && !ctx.heartEvents.includes(unlock.heartEvent)) return false;
  if (unlock.letter !== undefined && ctx.mail[unlock.letter] !== 'read') return false;
  return true;
}
