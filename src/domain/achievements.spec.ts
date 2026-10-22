import { describe, expect, it } from 'vitest';
import {
  bumpCounter,
  conditionMet,
  emptyAchievements,
  markUnlocked,
  newlyUnlocked,
  type AchievementContext,
  type AchievementDef,
} from './achievements';

function ctx(overrides: Partial<AchievementContext> = {}): AchievementContext {
  return {
    counters: {},
    flags: {},
    dexCount: () => 0,
    hearts: () => 0,
    residents: ['maomao', 'rong-bo'],
    ...overrides,
  };
}

const HARVEST_ONCE: AchievementDef = {
  id: 'first-harvest',
  name: '第一次收成',
  description: '收成一次作物。',
  condition: { type: 'counter', key: 'harvest', min: 1 },
  reward: { gold: 50 },
  phase: 'spring',
  playMinutes: 0.5,
};

describe('成就的條件', () => {
  it('計數器：達到 min 才算', () => {
    const cond = { type: 'counter' as const, key: 'harvest', min: 3 };
    expect(conditionMet(cond, ctx({ counters: { harvest: 2 } }))).toBe(false);
    expect(conditionMet(cond, ctx({ counters: { harvest: 3 } }))).toBe(true);
  });

  it('旗標：旗標為真才算', () => {
    const cond = { type: 'flag' as const, flag: 'main:3' };
    expect(conditionMet(cond, ctx({ flags: { 'main:3': true } }))).toBe(true);
    expect(conditionMet(cond, ctx({ flags: { 'main:3': false } }))).toBe(false);
  });

  it('圖鑑：某一類發現的條目數達到 count', () => {
    const cond = { type: 'dex' as const, category: 'fish', count: 4 };
    expect(conditionMet(cond, ctx({ dexCount: (c) => (c === 'fish' ? 3 : 0) }))).toBe(false);
    expect(conditionMet(cond, ctx({ dexCount: (c) => (c === 'fish' ? 4 : 0) }))).toBe(true);
  });

  it('好感 any：有一位居民到了就算；all：每一位居民都要到', () => {
    const any = { type: 'hearts' as const, min: 2, scope: 'any' as const };
    const all = { type: 'hearts' as const, min: 2, scope: 'all' as const };
    const hearts = (id: string) => (id === 'maomao' ? 2 : 1);
    expect(conditionMet(any, ctx({ hearts }))).toBe(true);
    expect(conditionMet(all, ctx({ hearts }))).toBe(false);
    expect(conditionMet(all, ctx({ hearts: () => 2 }))).toBe(true);
  });
});

describe('成就的達成（只給一次）', () => {
  it('條件達成的成就會被列出；達成後標記，之後不再列出', () => {
    const state = bumpCounter(emptyAchievements(), 'harvest', 1);
    const first = newlyUnlocked([HARVEST_ONCE], state, ctx({ counters: state.counters }));
    expect(first.map((d) => d.id)).toEqual(['first-harvest']);
    const done = markUnlocked(state, HARVEST_ONCE);
    expect(done.unlocked).toEqual(['first-harvest']);
    expect(newlyUnlocked([HARVEST_ONCE], done, ctx({ counters: done.counters }))).toEqual([]);
  });

  it('稱號的獎勵會記在狀態的稱號清單裡；只有金錢的獎勵不加稱號', () => {
    const titled: AchievementDef = { ...HARVEST_ONCE, id: 'titled', reward: { title: '田裡的老手' } };
    expect(markUnlocked(emptyAchievements(), titled).titles).toEqual(['田裡的老手']);
    expect(markUnlocked(emptyAchievements(), HARVEST_ONCE).titles).toEqual([]);
  });

  it('計數器只會增加，並且不改動其他計數', () => {
    const once = bumpCounter(emptyAchievements(), 'ship', 1);
    const twice = bumpCounter(once, 'ship', 2);
    expect(twice.counters).toEqual({ ship: 3 });
    expect(once.counters).toEqual({ ship: 1 });
  });
});
