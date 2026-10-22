import { describe, expect, it } from 'vitest';
import { collectionRatio, friendshipRatio, ratingOf, type RatingRules } from './rating';

const RULES: RatingRules = {
  weights: { income: 0.5, collection: 0.25, friendship: 0.25 },
  incomeFull: 1000,
  grades: [
    { grade: 'S', min: 0.9 },
    { grade: 'A', min: 0.75 },
    { grade: 'B', min: 0.5 },
    { grade: 'C', min: 0 },
  ],
};

describe('農場評級的計分（三項加權，見 content/rating.json）', () => {
  it('三項都滿分就是總分 1、評級 S', () => {
    expect(ratingOf({ yearlyIncome: 1000, collectionRatio: 1, friendshipRatio: 1 }, RULES)).toEqual({
      score: 1,
      grade: 'S',
      parts: { income: 1, collection: 1, friendship: 1 },
    });
  });

  it('收入超過 incomeFull 也只算滿分 1，不會超過', () => {
    const result = ratingOf({ yearlyIncome: 99999, collectionRatio: 0, friendshipRatio: 0 }, RULES);
    expect(result.parts.income).toBe(1);
    expect(result.score).toBe(0.5);
  });

  it('只有收入達標（權重 0.5）得 0.5，評級 B', () => {
    const result = ratingOf({ yearlyIncome: 1000, collectionRatio: 0, friendshipRatio: 0 }, RULES);
    expect(result.score).toBe(0.5);
    expect(result.grade).toBe('B');
  });

  it('門檻邊界：剛好等於 A 的門檻（0.75）就是 A', () => {
    // 收入 0.5 + 圖鑑 0.25 + 好感 0 = 0.75
    const result = ratingOf({ yearlyIncome: 1000, collectionRatio: 1, friendshipRatio: 0 }, RULES);
    expect(result.score).toBe(0.75);
    expect(result.grade).toBe('A');
  });

  it('門檻邊界：略低於 A 的門檻就掉到 B', () => {
    // 收入 0.5 + 圖鑑 0.2475 + 好感 0 = 0.7475
    const result = ratingOf({ yearlyIncome: 1000, collectionRatio: 0.99, friendshipRatio: 0 }, RULES);
    expect(result.grade).toBe('B');
  });

  it('什麼都沒有就是 C', () => {
    expect(ratingOf({ yearlyIncome: 0, collectionRatio: 0, friendshipRatio: 0 }, RULES)).toEqual({
      score: 0,
      grade: 'C',
      parts: { income: 0, collection: 0, friendship: 0 },
    });
  });

  it('輸入的比例會被限制在 0 到 1 之間', () => {
    const result = ratingOf({ yearlyIncome: -50, collectionRatio: 2, friendshipRatio: 0.5 }, RULES);
    expect(result.parts).toEqual({ income: 0, collection: 1, friendship: 0.5 });
  });
});

describe('圖鑑比例與好感比例', () => {
  it('圖鑑比例是已發現條目數除以全部條目數（跨類別合計）', () => {
    const categories = [{ entries: ['a', 'b', 'c', 'd'] }, { entries: ['e', 'f'] }];
    expect(collectionRatio(categories, ['a', 'e'])).toBeCloseTo(2 / 6);
  });

  it('沒有任何圖鑑條目時比例是 0（不會除以 0）', () => {
    expect(collectionRatio([], [])).toBe(0);
  });

  it('好感比例是居民點數的平均除以滿點；沒有紀錄的居民算 0 點', () => {
    expect(friendshipRatio(['x', 'y'], { x: { points: 40 }, y: { points: 0 } }, 80)).toBe(0.25);
    expect(friendshipRatio(['x', 'y'], { x: { points: 80 } }, 80)).toBe(0.5);
  });

  it('沒有居民或滿點為 0 時好感比例是 0', () => {
    expect(friendshipRatio([], {}, 80)).toBe(0);
    expect(friendshipRatio(['x'], { x: { points: 10 } }, 0)).toBe(0);
  });
});
