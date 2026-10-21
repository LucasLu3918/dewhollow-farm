import type { Weather } from './weather';

/**
 * 居民行程：依時段（早、午、傍晚）與天氣，決定居民在哪張地圖的哪一格。
 * 行程資料在 content/schedules.json；這裡只做查詢。
 */

export const PERIODS = ['morning', 'noon', 'evening'] as const;
export type Period = (typeof PERIODS)[number];

/** 時段的分界（一天從 00:00 起算的分鐘數）：中午從 noon 開始，傍晚從 evening 開始。 */
export interface PeriodRules {
  noon: number;
  evening: number;
}

export function periodOf(minuteOfDay: number, rules: PeriodRules): Period {
  if (minuteOfDay >= rules.evening) return 'evening';
  if (minuteOfDay >= rules.noon) return 'noon';
  return 'morning';
}

export interface ScheduleEntry {
  npcId: string;
  period: Period;
  /** 省略表示任何天氣都適用（預設行程）；有列出時只在這些天氣才用。 */
  weather?: Weather[];
  mapId: string;
  x: number;
  y: number;
}

export interface ScheduleDef {
  periods: PeriodRules;
  entries: ScheduleEntry[];
}

export interface Spot {
  mapId: string;
  x: number;
  y: number;
}

/**
 * 居民在某時段、某天氣下的位置。符合天氣的行程優先，否則用預設行程；都沒有時回傳 null（不在場）。
 */
export function spotOf(schedule: ScheduleDef, npcId: string, period: Period, weather: Weather): Spot | null {
  const mine = schedule.entries.filter((entry) => entry.npcId === npcId && entry.period === period);
  const entry = mine.find((e) => e.weather?.includes(weather)) ?? mine.find((e) => e.weather === undefined);
  return entry ? { mapId: entry.mapId, x: entry.x, y: entry.y } : null;
}
