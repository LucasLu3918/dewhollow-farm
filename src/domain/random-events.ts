import { SEASONS, totalDay, type Calendar, type Season } from './calendar';
import { advanceRng, rollInt } from './random';
import type { Period } from './schedule';
import type { Weather } from './weather';

/**
 * 隨機事件（M5d）：每天一次機率，條件限定季節、天氣與星期。以日期種子（年、季、日）決定，同一天永遠相同。
 * 內容在 content/events-random.json；這裡只做判斷。效果限定在產出、機率、旗標與物品，不改任何體力成本。
 */

export type EventEffect =
  /** 物品：白天的事件在睡醒時入袋，夜間的事件在睡前入袋（放不下就不入袋）。 */
  | { type: 'grant'; items: Record<string, number> }
  /** 採集的額外產出機率加成（只在當天）；chance 為 0 到 1 的機率。 */
  | { type: 'yield'; action: 'harvest' | 'forage' | 'chop' | 'mine'; chance: number }
  /** 釣魚上鉤機率加成（只在當天），單位是百分點。 */
  | { type: 'bite'; points: number }
  /** 居民行程改變：這個時段，居民改到指定地點的指定位置。 */
  | { type: 'concert'; mapId: string; period: Period; spots: { npcId: string; x: number; y: number }[] };

export interface RandomEventDef {
  id: string;
  name: string;
  /** 睡醒時告知玩家的文字。 */
  message: string;
  seasons: Season[];
  /** 可能出現的天氣；空清單表示任何天氣。 */
  weathers: Weather[];
  /** 可能出現的星期（0 為週一，6 為週日）；空清單表示任何一天。 */
  weekdays: number[];
  /** 夜間事件的物品在睡前入袋；白天的事件在睡醒時入袋。 */
  period: 'day' | 'night';
  effect: EventEffect;
  playMinutes: number;
}

export interface DailyEventRules {
  /** 每天出現事件的機率（百分比，0 到 100）。 */
  chance: number;
  events: RandomEventDef[];
}

/** 今天的事件紀錄（day 是事件那天的總天數；id 為 null 表示今天沒有事件）。 */
export interface TodayEvent {
  day: number;
  id: string | null;
}

export function noEvent(): TodayEvent {
  return { day: 0, id: null };
}

/** 星期：第 1 天是週一（0），每 7 天一輪。 */
export function weekdayOf(total: number): number {
  return (total - 1) % 7;
}

/** 這個季節、天氣、星期能出現的事件（順序與內容檔相同）。 */
export function eligibleEvents(rules: DailyEventRules, season: Season, weather: Weather, weekday: number): RandomEventDef[] {
  return rules.events.filter(
    (event) =>
      event.seasons.includes(season) &&
      (event.weathers.length === 0 || event.weathers.includes(weather)) &&
      (event.weekdays.length === 0 || event.weekdays.includes(weekday)),
  );
}

/**
 * 這一天的事件：先以日期種子擲機率（不中就沒有事件），中了再依權重從符合條件的事件裡挑一個。
 * 同一個日期與條件永遠得到同一個結果；不抽隨機數狀態，所以不影響其他隨機結果。
 */
export function rollDailyEvent(rules: DailyEventRules, calendar: Calendar, weather: Weather, daysPerSeason: number): RandomEventDef | null {
  const eligible = eligibleEvents(rules, calendar.season, weather, weekdayOf(totalDay(calendar, daysPerSeason)));
  if (eligible.length === 0) return null;
  const gate = rollInt(dateSeed(calendar), 1, 100);
  if (gate.value > rules.chance) return null;
  const pick = rollInt(gate.rng, 1, eligible.length);
  return eligible[pick.value - 1] ?? null;
}

/** 日期種子：年、季、日混成一個隨機數狀態（與佈告欄的種子分開，互不影響）。 */
function dateSeed(calendar: Calendar): number {
  let hash = 2166136261;
  for (const part of [3, calendar.year, SEASONS.indexOf(calendar.season), calendar.day]) {
    hash = Math.imul(hash ^ part, 16777619) >>> 0;
  }
  return advanceRng(advanceRng(hash));
}
