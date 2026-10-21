import { describe, expect, it } from 'vitest';
import { periodOf, spotOf, type PeriodRules, type ScheduleDef } from './schedule';

const RULES: PeriodRules = { noon: 720, evening: 1020 };

describe('時段', () => {
  it('中午之前是早上，中午到下午 5 點前是中午，之後是傍晚', () => {
    expect(periodOf(360, RULES)).toBe('morning');
    expect(periodOf(719, RULES)).toBe('morning');
    expect(periodOf(720, RULES)).toBe('noon');
    expect(periodOf(1019, RULES)).toBe('noon');
    expect(periodOf(1020, RULES)).toBe('evening');
    expect(periodOf(1400, RULES)).toBe('evening');
  });
});

describe('行程', () => {
  const schedule: ScheduleDef = {
    periods: RULES,
    entries: [
      { npcId: 'a', period: 'morning', mapId: 'village', x: 1, y: 1 },
      { npcId: 'a', period: 'morning', weather: ['rain', 'storm'], mapId: 'village', x: 2, y: 2 },
      { npcId: 'a', period: 'noon', mapId: 'plaza', x: 3, y: 3 },
    ],
  };

  it('符合天氣的行程優先，否則用沒有天氣條件的預設行程', () => {
    expect(spotOf(schedule, 'a', 'morning', 'sunny')).toEqual({ mapId: 'village', x: 1, y: 1 });
    expect(spotOf(schedule, 'a', 'morning', 'rain')).toEqual({ mapId: 'village', x: 2, y: 2 });
    expect(spotOf(schedule, 'a', 'morning', 'storm')).toEqual({ mapId: 'village', x: 2, y: 2 });
  });

  it('沒有排行程的居民或時段回傳 null（不在場）', () => {
    expect(spotOf(schedule, 'a', 'evening', 'sunny')).toBeNull();
    expect(spotOf(schedule, 'b', 'morning', 'sunny')).toBeNull();
  });
});
