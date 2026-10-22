import { calendarOnDay, SEASONS, totalDay, type Calendar, type Season } from './calendar';
import { advanceRng, rollInt } from './random';
import { weekdayOf } from './random-events';

/**
 * 旅行商人（P0，見 docs/CONTENT_PLAN.md 的「帆」）：每週五、六在鎮廣場出現一次，賣稀有種子與裝飾。
 * 貨架每週輪換：以「那一週的週一」為錨點，用年、季、日的種子從候選清單抽名額內的件數（同一週結果相同）。
 * 內容在 content/traveling-merchant.json，這裡只做判斷；購買與扣款在 application/game-commands.ts 的 buy。
 */

export interface MerchantCandidate {
  itemId: string;
  price: number;
  /** 只在這些季節上架（省略為四季皆有）；以該週週一的季節為準。 */
  seasons?: Season[];
}

export interface MerchantRules {
  /** 來訪的星期（0 為週一，6 為週日）；預設是週五、六。 */
  weekdays: number[];
  /** 每週上架的件數範圍（抽出來的件數落在這個範圍內，候選不足時全部上架）。 */
  slots: { min: number; max: number };
  /** 每週每一件最多能買幾個（同一週週五與週六共用）。 */
  perItemWeekly: number;
  /** 第一次逛到旅行商人的內容時數估計（分鐘），見 docs/PLAYTIME_PLAN.md。 */
  playMinutes: number;
  candidates: MerchantCandidate[];
}

/** 旅行商人本週的購買紀錄：week 是那一週週一的總天數；換週後購買數量歸零。 */
export interface MerchantLog {
  week: number;
  bought: Record<string, number>;
}

/** 貨架上的一件（價格取自候選）。 */
export interface MerchantLine {
  itemId: string;
  price: number;
}

export function emptyMerchantLog(): MerchantLog {
  return { week: 0, bought: {} };
}

/** 這一天所在那一週的週一（總天數）。週五與週六的結果相同，就是因為它們的週一相同。 */
export function weekStartOf(calendar: Calendar, daysPerSeason: number): number {
  const total = totalDay(calendar, daysPerSeason);
  return total - weekdayOf(total);
}

/** 今天旅行商人在不在鎮廣場（只看星期）。 */
export function merchantOpen(rules: MerchantRules, calendar: Calendar, daysPerSeason: number): boolean {
  return rules.weekdays.includes(weekdayOf(totalDay(calendar, daysPerSeason)));
}

/** 這一週（以週一為錨點）的貨架：3 到 4 件，不重複，依候選清單的順序排列。 */
export function weekStock(rules: MerchantRules, calendar: Calendar, daysPerSeason: number): MerchantLine[] {
  const monday = calendarOnDay(weekStartOf(calendar, daysPerSeason), daysPerSeason, 0);
  const eligible = rules.candidates.filter((c) => !c.seasons || c.seasons.includes(monday.season));
  const count = rollInt(weekSeed(monday), rules.slots.min, rules.slots.max);
  let rng = count.rng;
  const pool = [...eligible];
  const chosen: MerchantCandidate[] = [];
  for (let i = 0; i < count.value && pool.length > 0; i += 1) {
    const pick = rollInt(rng, 1, pool.length);
    rng = pick.rng;
    const [candidate] = pool.splice(pick.value - 1, 1);
    if (candidate) chosen.push(candidate);
  }
  chosen.sort((a, b) => rules.candidates.indexOf(a) - rules.candidates.indexOf(b));
  return chosen.map((c) => ({ itemId: c.itemId, price: c.price }));
}

/** 這一週已經買過的數量（換週後是空的）。 */
export function boughtThisWeek(log: MerchantLog, calendar: Calendar, daysPerSeason: number): Record<string, number> {
  return log.week === weekStartOf(calendar, daysPerSeason) ? log.bought : {};
}

/** 週的種子：年、季、週一的日，混成一個隨機數狀態（與隨機事件、佈告欄的種子分開）。 */
function weekSeed(monday: Calendar): number {
  let hash = 2166136261;
  for (const part of [5, monday.year, SEASONS.indexOf(monday.season), monday.day]) {
    hash = Math.imul(hash ^ part, 16777619) >>> 0;
  }
  return advanceRng(advanceRng(hash));
}
