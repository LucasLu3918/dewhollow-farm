export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export const SEASON_NAMES: Record<Season, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
};

export interface Calendar {
  year: number;
  season: Season;
  /** 這個季節的第幾天，從 1 開始。 */
  day: number;
  /** 一天從 00:00 起算的分鐘數。 */
  minuteOfDay: number;
}

export function createCalendar(wakeMinute: number): Calendar {
  return { year: 1, season: 'spring', day: 1, minuteOfDay: wakeMinute };
}

export function advanceMinutes(calendar: Calendar, minutes: number): Calendar {
  return { ...calendar, minuteOfDay: calendar.minuteOfDay + minutes };
}

export interface MorningStep {
  calendar: Calendar;
  /** 這次睡醒是否進入了新的季節（包含跨年）。 */
  seasonChanged: boolean;
}

/** 睡醒：日數加一；季節滿了就換季，冬天結束就進入下一年的春天。 */
export function nextMorning(calendar: Calendar, wakeMinute: number, daysPerSeason: number): MorningStep {
  if (calendar.day < daysPerSeason) {
    return { calendar: { ...calendar, day: calendar.day + 1, minuteOfDay: wakeMinute }, seasonChanged: false };
  }
  const index = SEASONS.indexOf(calendar.season);
  const wrapped = index === SEASONS.length - 1;
  const next: Calendar = {
    year: wrapped ? calendar.year + 1 : calendar.year,
    season: SEASONS[(index + 1) % SEASONS.length] ?? 'spring',
    day: 1,
    minuteOfDay: wakeMinute,
  };
  return { calendar: next, seasonChanged: true };
}

/** 從開始到現在的總天數，第 1 天為 1。 */
export function totalDay(calendar: Calendar, daysPerSeason: number): number {
  const seasonIndex = SEASONS.indexOf(calendar.season);
  return (calendar.year - 1) * SEASONS.length * daysPerSeason + seasonIndex * daysPerSeason + calendar.day;
}

/** 依總天數重建日曆（遷移舊存檔時使用）。 */
export function calendarOnDay(total: number, daysPerSeason: number, wakeMinute: number): Calendar {
  if (!Number.isInteger(total) || total < 1) throw new RangeError(`總天數必須是 1 以上的整數：${total}`);
  const perYear = SEASONS.length * daysPerSeason;
  const zero = total - 1;
  const seasonIndex = Math.floor((zero % perYear) / daysPerSeason);
  return {
    year: Math.floor(zero / perYear) + 1,
    season: SEASONS[seasonIndex] ?? 'spring',
    day: (zero % daysPerSeason) + 1,
    minuteOfDay: wakeMinute,
  };
}

export function dateLabel(calendar: Calendar): string {
  return `第 ${calendar.year} 年 ${SEASON_NAMES[calendar.season]} 第 ${calendar.day} 天`;
}

export function formatClock(calendar: Calendar): string {
  const hours = Math.floor(calendar.minuteOfDay / 60) % 24;
  const minutes = calendar.minuteOfDay % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
