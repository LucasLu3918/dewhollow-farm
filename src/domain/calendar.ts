export type Season = 'spring';

export interface Calendar {
  year: number;
  season: Season;
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

export function sleepUntilMorning(calendar: Calendar, wakeMinute: number): Calendar {
  return { ...calendar, day: calendar.day + 1, minuteOfDay: wakeMinute };
}

export function formatClock(calendar: Calendar): string {
  const hours = Math.floor(calendar.minuteOfDay / 60) % 24;
  const minutes = calendar.minuteOfDay % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
