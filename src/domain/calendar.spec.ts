import { describe, expect, it } from 'vitest';
import { advanceMinutes, createCalendar, formatClock, sleepUntilMorning } from './calendar';

const WAKE_MINUTE = 6 * 60;

describe('calendar', () => {
  it('starts on spring day 1 at wake time', () => {
    const c = createCalendar(WAKE_MINUTE);
    expect(c).toEqual({ year: 1, season: 'spring', day: 1, minuteOfDay: WAKE_MINUTE });
    expect(formatClock(c)).toBe('06:00');
  });

  it('advances the clock by minutes', () => {
    const c = advanceMinutes(createCalendar(WAKE_MINUTE), 10);
    expect(formatClock(c)).toBe('06:10');
    expect(c.day).toBe(1);
  });

  it('sleeping moves to the next morning and increments the day', () => {
    const late = advanceMinutes(createCalendar(WAKE_MINUTE), 600);
    const next = sleepUntilMorning(late, WAKE_MINUTE);
    expect(next.day).toBe(2);
    expect(formatClock(next)).toBe('06:00');
  });
});
