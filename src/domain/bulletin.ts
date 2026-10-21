import { SEASONS, totalDay, type Calendar } from './calendar';
import { advanceRng, rollInt } from './random';

/**
 * 佈告欄的抽取規則（內容在 content/quests.json 的 bulletin）：
 * 每天從 daily 候選清單抽 dailyCount 件（以年、季、日的日期種子決定）；
 * 每週從 weekly 候選清單抽 1 件大委託（以週的日期種子決定）。同一天、同一週抽到的結果永遠一樣。
 */
export interface BulletinRules {
  /** 佈告欄的委託沒有委託人時，畫面顯示的發布單位。 */
  postedBy: string;
  dailyCount: number;
  daily: string[];
  weekly: string[];
}

/** 佈告欄今天的抽取結果。day 是抽取當天的總天數；0 表示還沒抽過。 */
export interface BoardState {
  day: number;
  daily: string[];
  weekly: string | null;
}

export const EMPTY_BOARD: BoardState = { day: 0, daily: [], weekly: null };

/** 這一天的佈告欄內容（純函式：同樣的日期與規則，永遠得到同樣的結果）。 */
export function drawBoard(rules: BulletinRules, calendar: Calendar, daysPerSeason: number): BoardState {
  const day = totalDay(calendar, daysPerSeason);
  const seasonIndex = SEASONS.indexOf(calendar.season);
  const daily = pickDistinct(dateSeed(calendar.year, seasonIndex, calendar.day), rules.daily, rules.dailyCount);
  const weekly = rules.weekly.length === 0 ? null : (pickDistinct(weekSeed(weekOf(day)), rules.weekly, 1)[0] ?? null);
  return { day, daily, weekly };
}

/** 狀態是今天抽的就沿用，否則重新抽。 */
export function boardFor(rules: BulletinRules, state: BoardState, calendar: Calendar, daysPerSeason: number): BoardState {
  const today = totalDay(calendar, daysPerSeason);
  if (state.day !== 0 && state.day === today) return state;
  return drawBoard(rules, calendar, daysPerSeason);
}

/** 總天數所在的週（從第 1 天起每 7 天一週，從 0 開始計）。 */
export function weekOf(total: number): number {
  return Math.floor((total - 1) / 7);
}

/**
 * 從候選清單不重複地抽出 count 件（不足時給全部）。
 * seed 是隨機數狀態；同一個 seed 與清單永遠得到同樣的順序。
 */
export function pickDistinct(seed: number, pool: readonly string[], count: number): string[] {
  const left = [...pool];
  const picked: string[] = [];
  let rng = seed;
  while (picked.length < count && left.length > 0) {
    const roll = rollInt(rng, 0, left.length - 1);
    rng = roll.rng;
    const [chosen] = left.splice(roll.value, 1);
    if (chosen !== undefined) picked.push(chosen);
  }
  return picked;
}

function dateSeed(year: number, seasonIndex: number, day: number): number {
  return mix(1, year, seasonIndex, day);
}

function weekSeed(week: number): number {
  return mix(2, week);
}

/** 把幾個整數混成一個隨機數狀態（FNV 式混合後再推進幾次，讓相近的日子也分得開）。 */
function mix(...parts: number[]): number {
  let hash = 2166136261;
  for (const part of parts) {
    hash = Math.imul(hash ^ part, 16777619) >>> 0;
  }
  return advanceRng(advanceRng(hash));
}
