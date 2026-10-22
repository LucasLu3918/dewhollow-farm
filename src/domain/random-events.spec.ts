import { describe, expect, it } from 'vitest';
import type { Calendar } from './calendar';
import { eligibleEvents, rollDailyEvent, weekdayOf, type DailyEventRules, type RandomEventDef } from './random-events';

const DAYS_PER_SEASON = 20;

function on(season: Calendar['season'], day: number, year = 1): Calendar {
  return { year, season, day, minuteOfDay: 420 };
}

const ALWAYS: RandomEventDef = {
  id: 'always',
  name: '每天',
  message: '每天都會來。',
  seasons: ['spring', 'summer'],
  weathers: [],
  weekdays: [],
  period: 'day',
  effect: { type: 'grant', items: { hay: 1 } },
  playMinutes: 1,
};

const RAIN_ONLY: RandomEventDef = { ...ALWAYS, id: 'rain-only', name: '只有雨天', weathers: ['rain', 'wind'] };
const FRIDAY_ONLY: RandomEventDef = { ...ALWAYS, id: 'friday', name: '只有週五', weekdays: [4] };
const WINTER: RandomEventDef = { ...ALWAYS, id: 'winter', name: '只有冬天', seasons: ['winter'] };
const RULES: DailyEventRules = { chance: 100, events: [ALWAYS, RAIN_ONLY, FRIDAY_ONLY, WINTER] };

describe('隨機事件的條件（季節、天氣、星期）', () => {
  it('季節不符的事件不會出現', () => {
    const ids = eligibleEvents(RULES, 'spring', 'sunny', 0).map((e) => e.id);
    expect(ids).not.toContain('winter');
    expect(ids).toContain('always');
  });

  it('天氣限定的事件只在指定天氣出現；空清單代表任何天氣', () => {
    expect(eligibleEvents(RULES, 'spring', 'sunny', 0).map((e) => e.id)).not.toContain('rain-only');
    expect(eligibleEvents(RULES, 'spring', 'wind', 0).map((e) => e.id)).toContain('rain-only');
    expect(eligibleEvents(RULES, 'spring', 'snow', 0).map((e) => e.id)).toContain('always');
  });

  it('星期限定的事件只在指定的星期出現（0 為週一，4 為週五）', () => {
    expect(eligibleEvents(RULES, 'spring', 'sunny', 4).map((e) => e.id)).toContain('friday');
    expect(eligibleEvents(RULES, 'spring', 'sunny', 3).map((e) => e.id)).not.toContain('friday');
  });

  it('weekdayOf：第 1 天是週一，每 7 天一輪', () => {
    expect(weekdayOf(1)).toBe(0);
    expect(weekdayOf(5)).toBe(4);
    expect(weekdayOf(8)).toBe(0);
  });
});

describe('每日事件的抽取（日期種子）', () => {
  it('同一天、同一條件，結果永遠相同（可重現）', () => {
    const a = rollDailyEvent(RULES, on('spring', 9), 'sunny', DAYS_PER_SEASON);
    const b = rollDailyEvent(RULES, on('spring', 9), 'sunny', DAYS_PER_SEASON);
    expect(a?.id).toBe(b?.id);
  });

  it('不同天會得到不同結果（一整季的抽取不會全都一樣）', () => {
    const ids = new Set<string | undefined>();
    for (let day = 1; day <= DAYS_PER_SEASON; day += 1) {
      ids.add(rollDailyEvent(RULES, on('summer', day), 'sunny', DAYS_PER_SEASON)?.id);
    }
    expect(ids.size).toBeGreaterThan(1);
  });

  it('年不同、日期相同也會得到不同的種子（跨年不重複同一套）', () => {
    const years = new Set<string | undefined>();
    for (let year = 1; year <= 12; year += 1) {
      years.add(rollDailyEvent(RULES, on('spring', 5, year), 'sunny', DAYS_PER_SEASON)?.id);
    }
    expect(years.size).toBeGreaterThan(1);
  });

  it('機率為 0 的那天不會有事件；沒有符合條件的事件也是沒有事件', () => {
    const none = { chance: 0, events: [ALWAYS] };
    for (let day = 1; day <= DAYS_PER_SEASON; day += 1) {
      expect(rollDailyEvent(none, on('spring', day), 'sunny', DAYS_PER_SEASON)).toBeNull();
    }
    expect(rollDailyEvent({ chance: 100, events: [WINTER] }, on('spring', 4), 'sunny', DAYS_PER_SEASON)).toBeNull();
  });

  it('抽到的事件一定符合當天的條件', () => {
    for (let day = 1; day <= DAYS_PER_SEASON; day += 1) {
      const event = rollDailyEvent(RULES, on('spring', day), 'wind', DAYS_PER_SEASON);
      if (event) expect(['always', 'rain-only', 'friday']).toContain(event.id);
    }
  });
});
