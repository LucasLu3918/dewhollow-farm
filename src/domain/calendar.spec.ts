import { describe, expect, it } from 'vitest';
import { advanceMinutes, calendarOnDay, createCalendar, dateLabel, formatClock, nextMorning, totalDay } from './calendar';

const WAKE_MINUTE = 6 * 60;
const DAYS = 20;

/** 睡到隔天早上幾次，回傳最後的日曆與途中是否換季。 */
function sleepMany(start: ReturnType<typeof createCalendar>, times: number) {
  let calendar = start;
  let seasonChanges = 0;
  for (let i = 0; i < times; i += 1) {
    const step = nextMorning(calendar, WAKE_MINUTE, DAYS);
    if (step.seasonChanged) seasonChanges += 1;
    calendar = step.calendar;
  }
  return { calendar, seasonChanges };
}

describe('calendar', () => {
  it('starts on spring day 1 of year 1 at wake time', () => {
    const c = createCalendar(WAKE_MINUTE);
    expect(c).toEqual({ year: 1, season: 'spring', day: 1, minuteOfDay: WAKE_MINUTE });
    expect(formatClock(c)).toBe('06:00');
    expect(dateLabel(c)).toBe('第 1 年 春 第 1 天');
  });

  it('advances the clock by minutes without changing the day', () => {
    const c = advanceMinutes(createCalendar(WAKE_MINUTE), 10);
    expect(formatClock(c)).toBe('06:10');
    expect(c.day).toBe(1);
  });

  it('sleeping moves to the next morning of the same season', () => {
    const late = advanceMinutes(createCalendar(WAKE_MINUTE), 600);
    const step = nextMorning(late, WAKE_MINUTE, DAYS);
    expect(step.calendar.day).toBe(2);
    expect(step.calendar.season).toBe('spring');
    expect(step.seasonChanged).toBe(false);
    expect(formatClock(step.calendar)).toBe('06:00');
  });

  it('each season lasts 20 days, so the 20th day is followed by the next season', () => {
    const { calendar, seasonChanges } = sleepMany(createCalendar(WAKE_MINUTE), 19);
    expect(calendar.day).toBe(20);
    expect(calendar.season).toBe('spring');
    expect(seasonChanges).toBe(0);

    const summer = nextMorning(calendar, WAKE_MINUTE, DAYS);
    expect(summer.seasonChanged).toBe(true);
    expect(summer.calendar).toMatchObject({ year: 1, season: 'summer', day: 1 });
  });

  it('after winter the year goes up and spring starts again', () => {
    const { calendar, seasonChanges } = sleepMany(createCalendar(WAKE_MINUTE), 79);
    expect(calendar).toMatchObject({ year: 1, season: 'winter', day: 20 });
    expect(seasonChanges).toBe(3);

    const next = nextMorning(calendar, WAKE_MINUTE, DAYS);
    expect(next.seasonChanged).toBe(true);
    expect(next.calendar).toMatchObject({ year: 2, season: 'spring', day: 1 });
  });

  it('counts the total day since the start, 1-based', () => {
    expect(totalDay(createCalendar(WAKE_MINUTE), DAYS)).toBe(1);
    const { calendar } = sleepMany(createCalendar(WAKE_MINUTE), 24);
    expect(totalDay(calendar, DAYS)).toBe(25);
    expect(dateLabel(calendar)).toBe('第 1 年 夏 第 5 天');
  });

  it('can rebuild the calendar for any total day (used when migrating old saves)', () => {
    expect(calendarOnDay(1, DAYS, WAKE_MINUTE)).toEqual(createCalendar(WAKE_MINUTE));
    expect(calendarOnDay(25, DAYS, WAKE_MINUTE)).toMatchObject({ year: 1, season: 'summer', day: 5 });
    expect(calendarOnDay(81, DAYS, WAKE_MINUTE)).toMatchObject({ year: 2, season: 'spring', day: 1 });
    for (const total of [1, 20, 21, 40, 61, 80, 81, 160]) {
      expect(totalDay(calendarOnDay(total, DAYS, WAKE_MINUTE), DAYS)).toBe(total);
    }
  });

  it('rejects a total day below 1', () => {
    expect(() => calendarOnDay(0, DAYS, WAKE_MINUTE)).toThrow(RangeError);
  });
});
