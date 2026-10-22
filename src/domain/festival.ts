import type { Calendar, Season } from './calendar';
import type { MapDef } from './content';
import { plotKey } from './farm';

/**
 * 節慶（M5c）：日期、地點與開放時段的判斷，以及「每年每項活動一次」的紀錄。
 * 活動的數值與文字在 content/festivals.json；這裡只做判斷，不寫死任何數字。
 */

/** 豐穗祭的收成比賽：當天收成指定的作物，累計到 count 個就完成（每年一次獎勵）。 */
export interface HarvestContestRules {
  cropId: string;
  count: number;
  gold: number;
}

/** 暖燈節的點燈：廣場上的燈（tile.festival 為 lantern）每盞每年點一次；全部點亮發 allGold 並設定 flag。 */
export interface LanternRules {
  /** 要點亮的燈數（應等於地圖上燈的格數）。 */
  count: number;
  gold: number;
  allGold: number;
  flag: string;
}

/** 暖燈節的交換禮物：指定居民送禮不受每日一次限制，每年最多 perYear 次；每次收到回禮 receive。 */
export interface GiftExchangeRules {
  npcIds: string[];
  perYear: number;
  receive: { itemId: string; count: number };
}

/** 暖燈禮物在 festival.exchanged 裡的鍵（與星河兌換共用同一份每年計次）。 */
export const WARM_GIFT_LINE = 'warm-gift';

/** 種子交換：每位居民每年一次，玩家付出 give，拿到 receive。 */
export interface SeedSwapDef {
  npcId: string;
  give: { itemId: string; count: number };
  receive: { itemId: string; count: number };
}

export interface FestivalContestRules {
  /** 當年要釣到幾條魚才算完成。 */
  count: number;
  gold: number;
}

export interface FestivalStarRules {
  /** 一圈星星走完的毫秒數（一次收網的時限）。 */
  cycleMs: number;
  /** 收網有效的位置區間（0 到 1，見 star-fishing.ts）。 */
  zone: { from: number; to: number };
  /** 接到星星得到的物品。 */
  itemId: string;
}

/**
 * 星河兌換（夜市）：用付出的物品（星河碎片）換到物品，或解鎖一個旗標（例如合成配方的解鎖）。
 * 每項每年最多兌換 limit 次；碎片是背包的素材，跨年保留。
 */
export interface StarExchangeDef {
  id: string;
  name: string;
  give: { itemId: string; count: number };
  /** 換到的物品；省略表示只解鎖旗標。 */
  receive?: { itemId: string; count: number };
  /** 兌換後設為真的旗標（合成配方的 unlock.flag）。 */
  flag?: string;
  /** 每年最多兌換幾次。 */
  limit: number;
  /** 內容時數的估計（分鐘）。 */
  playMinutes: number;
}

export interface FestivalDef {
  id: string;
  name: string;
  season: Season;
  /** 這個季節的第幾天。 */
  day: number;
  /** 節慶的地點（鎮廣場）。 */
  mapId: string;
  /** 從這一分鐘起才開放（夜市是晚上）；0 為整天。 */
  fromMinute: number;
  /** 內容時數的估計（分鐘），見 docs/PLAYTIME_PLAN.md。 */
  playMinutes: number;
  /** 攤位所屬的店家（shops.json）；節慶開放時才能買。 */
  shop?: string;
  swaps?: SeedSwapDef[];
  crown?: { gold: number };
  contest?: FestivalContestRules;
  stars?: FestivalStarRules;
  /** 星河兌換的項目（見 StarExchangeDef）。 */
  exchange?: StarExchangeDef[];
  /** 收成比賽（豐穗祭）。 */
  harvestContest?: HarvestContestRules;
  /** 點燈（暖燈節）。 */
  lanterns?: LanternRules;
  /** 交換禮物（暖燈節）。 */
  giftExchange?: GiftExchangeRules;
}

export interface FestivalState {
  /** 每項活動最後一次參與的年份（鍵見 festivalKey）。 */
  done: Record<string, number>;
  /** 釣魚比賽：哪一年、已釣到幾條。跨年會重新計數。 */
  contest: { year: number; caught: number };
  /** 夜市攤位：哪一年、各物品已售出的數量。跨年會重新計數。 */
  sold: { year: number; counts: Record<string, number> };
  /** 星河兌換：哪一年、各項已兌換的次數。跨年會重新計數（碎片本身不會）。暖燈禮物也記在這裡（WARM_GIFT_LINE）。 */
  exchanged: { year: number; counts: Record<string, number> };
  /** 收成比賽（豐穗祭）：哪一年、指定作物已收成幾個。跨年會重新計數。 */
  harvest: { year: number; count: number };
}

export function emptyFestivalState(): FestivalState {
  return {
    done: {},
    contest: { year: 0, caught: 0 },
    sold: { year: 0, counts: {} },
    exchanged: { year: 0, counts: {} },
    harvest: { year: 0, count: 0 },
  };
}

/** 花冠製作用的合成配方（content/crafting.json）。 */
export const CROWN_RECIPE = 'flower-crown';

/** 節慶當天（含開始時段之後）才開放。 */
export function isOpen(def: FestivalDef, calendar: Calendar): boolean {
  return calendar.season === def.season && calendar.day === def.day && calendar.minuteOfDay >= def.fromMinute;
}

/** 今天是哪一天的節慶（不看時段；早上醒來時用來提示）；沒有就是 null。 */
export function festivalOnDay(defs: readonly FestivalDef[], calendar: Calendar): FestivalDef | null {
  return defs.find((def) => def.season === calendar.season && def.day === calendar.day) ?? null;
}

/** 現在正在進行的節慶（同一時間最多一個）；沒有就是 null。 */
export function openFestival(defs: readonly FestivalDef[], calendar: Calendar): FestivalDef | null {
  return defs.find((def) => isOpen(def, calendar)) ?? null;
}

/** 活動的紀錄鍵，例如 `sprout:crown`、`sprout:swap:maomao`。 */
export function festivalKey(festivalId: string, activity: string, subject?: string): string {
  return subject === undefined ? `${festivalId}:${activity}` : `${festivalId}:${activity}:${subject}`;
}

export function doneThisYear(state: FestivalState, key: string, year: number): boolean {
  return state.done[key] === year;
}

export function markDone(state: FestivalState, key: string, year: number): FestivalState {
  return { ...state, done: { ...state.done, [key]: year } };
}

/** 釣魚比賽多一條魚；跨年時從 1 重新計。 */
export function recordCatch(contest: FestivalState['contest'], year: number): FestivalState['contest'] {
  return contest.year === year ? { year, caught: contest.caught + 1 } : { year, caught: 1 };
}

export function contestReached(contest: FestivalState['contest'], rules: FestivalContestRules): boolean {
  return contest.caught >= rules.count;
}

export function soldThisYear(sold: FestivalState['sold'], year: number, itemId: string): number {
  return sold.year === year ? (sold.counts[itemId] ?? 0) : 0;
}

export function recordSale(sold: FestivalState['sold'], year: number, itemId: string, count: number): FestivalState['sold'] {
  const base = sold.year === year ? sold.counts : {};
  return { year, counts: { ...base, [itemId]: (base[itemId] ?? 0) + count } };
}

export function exchangedThisYear(exchanged: FestivalState['exchanged'], year: number, lineId: string): number {
  return exchanged.year === year ? (exchanged.counts[lineId] ?? 0) : 0;
}

export function recordExchange(exchanged: FestivalState['exchanged'], year: number, lineId: string): FestivalState['exchanged'] {
  const base = exchanged.year === year ? exchanged.counts : {};
  return { year, counts: { ...base, [lineId]: (base[lineId] ?? 0) + 1 } };
}

/** 收成比賽多收了 amount 個指定的作物；跨年時從頭重新計。 */
export function recordHarvest(harvest: FestivalState['harvest'], year: number, amount = 1): FestivalState['harvest'] {
  return harvest.year === year ? { year, count: harvest.count + amount } : { year, count: amount };
}

export function harvestContestReached(harvest: FestivalState['harvest'], rules: HarvestContestRules): boolean {
  return harvest.count >= rules.count;
}

/** 廣場上所有燈的格子（以 `x,y` 表示）。 */
export function lanternKeysOf(map: MapDef): string[] {
  const keys: string[] = [];
  map.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (map.legend[row.charAt(x)]?.festival === 'lantern') keys.push(plotKey(x, y));
    }
  });
  return keys;
}

/** 燈的紀錄鍵（每盞一個）。 */
export function lanternKey(festivalId: string, lampKey: string): string {
  return festivalKey(festivalId, 'lantern', lampKey);
}

/** 今年已經點亮的燈數（只算給定的燈格子）。 */
export function litLanterns(done: FestivalState['done'], festivalId: string, lampKeys: readonly string[], year: number): number {
  return lampKeys.filter((key) => done[lanternKey(festivalId, key)] === year).length;
}

/** 今年還能送幾次暖燈禮物（每年 perYear 次，與星河兌換共用同一份計次）。 */
export function warmGiftsLeft(exchanged: FestivalState['exchanged'], year: number, perYear: number): number {
  return Math.max(0, perYear - exchangedThisYear(exchanged, year, WARM_GIFT_LINE));
}

export interface ExchangeContext {
  /** 背包裡付出的物品有幾個。 */
  shards: number;
  year: number;
  exchanged: FestivalState['exchanged'];
  /** 兌換要解鎖的旗標是否已經為真。 */
  flagSet: boolean;
}

/**
 * 星河兌換的拒絕原因（失敗代碼），或 null 表示可以換。順序：今年已換滿、已解鎖過、碎片不夠。
 * 拒絕時不扣任何東西。
 */
export function exchangeRefusal(line: StarExchangeDef, ctx: ExchangeContext): string | null {
  if (exchangedThisYear(ctx.exchanged, ctx.year, line.id) >= line.limit) return 'EXCHANGE_LIMIT';
  if (line.flag !== undefined && ctx.flagSet) return 'ALREADY_UNLOCKED';
  if (ctx.shards < line.give.count) return 'NOT_ENOUGH_SHARDS';
  return null;
}
