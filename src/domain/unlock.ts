import type { Calendar, Season } from './calendar';
import { totalDay } from './calendar';

/**
 * 解鎖條件（門與場景用）。
 * - date：從某季某天起一直開放（之後的季節與年份都開放）。M5c 主線完成後，內容改為 flag 條件。
 * - flag：遊戲旗標（例如 cowbarn：牛舍已改建）為真時開放。
 * hint 是條件不符時顯示給玩家的話，寫在內容裡，不寫死在程式中。
 */
export type Requirement =
  | { type: 'date'; season: Season; day: number; hint: string; note?: string }
  | { type: 'flag'; flag: string; hint: string; note?: string };

export function requirementMet(
  requirement: Requirement,
  calendar: Calendar,
  flags: Readonly<Record<string, boolean>>,
  daysPerSeason: number,
): boolean {
  if (requirement.type === 'flag') return flags[requirement.flag] === true;
  const opensOn = totalDay({ year: 1, season: requirement.season, day: requirement.day, minuteOfDay: 0 }, daysPerSeason);
  return totalDay(calendar, daysPerSeason) >= opensOn;
}
