import { describe, expect, it } from 'vitest';
import type { Calendar } from './calendar';
import { requirementMet, type Requirement } from './unlock';

const DAYS_PER_SEASON = 20;
const onDate = (season: Calendar['season'], day: number, year = 1): Calendar => ({ year, season, day, minuteOfDay: 360 });
const SPRING_15: Requirement = { type: 'date', season: 'spring', day: 15, hint: '春 15 天起才開放' };

describe('date requirements (story flags come later)', () => {
  it('is not met before the date, and met on the date itself', () => {
    expect(requirementMet(SPRING_15, onDate('spring', 14), {}, DAYS_PER_SEASON)).toBe(false);
    expect(requirementMet(SPRING_15, onDate('spring', 15), {}, DAYS_PER_SEASON)).toBe(true);
  });

  it('stays met after the date: later seasons and later years are open too', () => {
    expect(requirementMet(SPRING_15, onDate('summer', 1), {}, DAYS_PER_SEASON)).toBe(true);
    expect(requirementMet(SPRING_15, onDate('spring', 1, 2), {}, DAYS_PER_SEASON)).toBe(true);
  });

  it('ignores the flags', () => {
    expect(requirementMet(SPRING_15, onDate('spring', 1), { anything: true }, DAYS_PER_SEASON)).toBe(false);
  });
});

describe('flag requirements', () => {
  const COWBARN: Requirement = { type: 'flag', flag: 'cowbarn', hint: '牛舍還沒改建' };

  it('is met only when the flag is set', () => {
    expect(requirementMet(COWBARN, onDate('spring', 1), {}, DAYS_PER_SEASON)).toBe(false);
    expect(requirementMet(COWBARN, onDate('spring', 1), { cowbarn: false }, DAYS_PER_SEASON)).toBe(false);
    expect(requirementMet(COWBARN, onDate('spring', 1), { cowbarn: true }, DAYS_PER_SEASON)).toBe(true);
  });
});
