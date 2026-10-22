import { describe, expect, it } from 'vitest';
import {
  claimKey,
  dueRewards,
  discoverEntries,
  emptyCollection,
  categoryCount,
  markClaimed,
  thresholdOf,
  type DexCategory,
} from './collection';

const FISH: DexCategory = {
  id: 'fish',
  name: '魚',
  phase: 'summer',
  playMinutes: 0.5,
  entries: ['fish.carp', 'fish.crucian', 'fish.bass', 'fish.reed-catfish', 'fish.silver-minnow', 'fish.mossy-perch', 'fish.veil-bream', 'fish.pebble-loach'],
  rewards: [
    { percent: 25, gold: 100 },
    { percent: 50, items: { 'night-canvas': 1 } },
    { percent: 75, gold: 200 },
    { percent: 100, title: '湖畔的常客', gold: 300 },
  ],
};

const DISHES: DexCategory = {
  id: 'dishes',
  name: '料理',
  phase: 'summer',
  playMinutes: 0.5,
  entries: ['dish.a', 'dish.b', 'dish.c', 'dish.d', 'dish.e'],
  rewards: [{ percent: 25, gold: 60 }],
};

describe('圖鑑的門檻（每類 25／50／75／100%，向上取整）', () => {
  it('八種魚：2、4、6、8 種', () => {
    expect([25, 50, 75, 100].map((p) => thresholdOf(8, p))).toEqual([2, 4, 6, 8]);
  });

  it('五種料理：有小數時向上取整（25% 是 2 種，50% 是 3 種）', () => {
    expect(thresholdOf(5, 25)).toBe(2);
    expect(thresholdOf(5, 50)).toBe(3);
    expect(thresholdOf(5, 100)).toBe(5);
  });
});

describe('發現條目（首次取得才計入）', () => {
  it('新的條目加進去；已經發現過的不重複計', () => {
    const once = discoverEntries(emptyCollection(), ['fish.carp']);
    expect(once.found).toEqual(['fish.carp']);
    const again = discoverEntries(once, ['fish.carp', 'fish.bass']);
    expect(again.found).toEqual(['fish.carp', 'fish.bass']);
  });

  it('沒有新條目時回傳同一個狀態（不改動）', () => {
    const state = discoverEntries(emptyCollection(), ['fish.carp']);
    expect(discoverEntries(state, ['fish.carp'])).toBe(state);
    expect(discoverEntries(state, [])).toBe(state);
  });

  it('類別的進度只數這一類的條目', () => {
    const state = discoverEntries(emptyCollection(), ['fish.carp', 'crop.dew-grass']);
    expect(categoryCount(FISH, state.found)).toBe(1);
    expect(categoryCount(DISHES, state.found)).toBe(0);
  });
});

describe('圖鑑獎勵（達到門檻就領，只領一次）', () => {
  it('達到 25% 才給 25% 的獎勵；沒達到的不給', () => {
    const one = discoverEntries(emptyCollection(), ['fish.carp']);
    expect(dueRewards(FISH, one.found, one.claimed).map((r) => r.percent)).toEqual([]);
    const two = discoverEntries(one, ['fish.bass']);
    expect(dueRewards(FISH, two.found, two.claimed).map((r) => r.percent)).toEqual([25]);
  });

  it('一次跨過好幾個門檻，就一起列出（依門檻由小到大）', () => {
    const many = discoverEntries(emptyCollection(), FISH.entries.slice(0, 6));
    expect(dueRewards(FISH, many.found, many.claimed).map((r) => r.percent)).toEqual([25, 50, 75]);
  });

  it('已經領過的不再列出；標記後的狀態記得', () => {
    const state = discoverEntries(emptyCollection(), FISH.entries.slice(0, 2));
    const claimed = markClaimed(state, [claimKey('fish', 25)]);
    expect(claimed.claimed).toEqual(['fish:25']);
    expect(dueRewards(FISH, claimed.found, claimed.claimed)).toEqual([]);
  });

  it('獎勵的內容（金錢、裝飾、稱號）原樣回傳', () => {
    const all = discoverEntries(emptyCollection(), FISH.entries);
    const last = dueRewards(FISH, all.found, all.claimed).at(-1);
    expect(last).toEqual({ percent: 100, title: '湖畔的常客', gold: 300 });
  });

  it('同一類只有一項獎勵時，料理也能正確領', () => {
    const state = discoverEntries(emptyCollection(), ['dish.a', 'dish.b']);
    expect(dueRewards(DISHES, state.found, state.claimed).map((r) => r.percent)).toEqual([25]);
  });
});
