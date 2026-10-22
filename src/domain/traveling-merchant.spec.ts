import { describe, expect, it } from 'vitest';
import { calendarOnDay, totalDay } from './calendar';
import { boughtThisWeek, emptyMerchantLog, merchantOpen, weekStartOf, weekStock, type MerchantRules } from './traveling-merchant';

const DAYS = 20;
const WAKE = 360;

/** 測試用的候選：三件季節限定、三件四季皆有（星期五、六來訪）。 */
const rules: MerchantRules = {
  weekdays: [4, 5],
  slots: { min: 3, max: 4 },
  perItemWeekly: 2,
  playMinutes: 2,
  candidates: [
    { itemId: 'seed.star-pepper', price: 90, seasons: ['summer'] },
    { itemId: 'seed.dusk-potato', price: 120, seasons: ['autumn'] },
    { itemId: 'seed.silver-wheat', price: 200, seasons: ['autumn', 'winter'] },
    { itemId: 'seed.moon-bean', price: 40, seasons: ['spring'] },
    { itemId: 'star-string', price: 260 },
    { itemId: 'night-canvas', price: 320 },
  ],
};

/** 第 total 天（第 1 天是週一）的日曆。 */
function day(total: number) {
  return calendarOnDay(total, DAYS, WAKE);
}

describe('旅行商人的出現：只在週五、週六的鎮廣場', () => {
  it('週五與週六開門，其餘五天不開', () => {
    const open = [1, 2, 3, 4, 5, 6, 7].map((total) => merchantOpen(rules, day(total), DAYS));
    // 第 1 天是週一：第 5 天是週五，第 6 天是週六。
    expect(open).toEqual([false, false, false, false, true, true, false]);
  });

  it('下一週的週五與週六也會開門', () => {
    expect(merchantOpen(rules, day(12), DAYS)).toBe(true);
    expect(merchantOpen(rules, day(13), DAYS)).toBe(true);
    expect(merchantOpen(rules, day(14), DAYS)).toBe(false);
  });
});

describe('每週輪換的貨架', () => {
  it('同一週的週五與週六結果相同（週一到週日都一樣）', () => {
    const friday = weekStock(rules, day(5), DAYS);
    const saturday = weekStock(rules, day(6), DAYS);
    expect(saturday).toEqual(friday);
    for (const total of [1, 2, 3, 4, 7]) expect(weekStock(rules, day(total), DAYS)).toEqual(friday);
  });

  it('同一週重複呼叫結果一致（可重現）', () => {
    expect(weekStock(rules, day(12), DAYS)).toEqual(weekStock(rules, day(13), DAYS));
    expect(weekStock(rules, day(12), DAYS)).toEqual(weekStock(rules, day(12), DAYS));
  });

  it('不同週會換貨（抽樣十週，不會全部一樣）', () => {
    const weeks = Array.from({ length: 10 }, (_, i) => JSON.stringify(weekStock(rules, day(5 + i * 7), DAYS)));
    expect(new Set(weeks).size).toBeGreaterThan(1);
  });

  it('每週 3 到 4 件，不重複，價格取自候選', () => {
    for (let week = 0; week < 12; week += 1) {
      const stock = weekStock(rules, day(5 + week * 7), DAYS);
      expect(stock.length).toBeGreaterThanOrEqual(3);
      expect(stock.length).toBeLessThanOrEqual(4);
      expect(new Set(stock.map((line) => line.itemId)).size).toBe(stock.length);
      for (const line of stock) {
        const candidate = rules.candidates.find((c) => c.itemId === line.itemId);
        expect(candidate?.price).toBe(line.price);
      }
    }
  });

  it('季節限定的候選只在它的季節上架（春季不會賣星辣椒）', () => {
    for (let week = 0; week < 12; week += 1) {
      const total = 5 + week * 7;
      // 季節以該週的週一為準（見 traveling-merchant.ts）。
      const season = day(weekStartOf(day(total), DAYS)).season;
      const stock = weekStock(rules, day(total), DAYS);
      for (const line of stock) {
        const candidate = rules.candidates.find((c) => c.itemId === line.itemId);
        if (candidate?.seasons) expect(candidate.seasons).toContain(season);
      }
    }
  });

  it('候選不足時，全部上架', () => {
    const few: MerchantRules = { ...rules, candidates: [{ itemId: 'star-string', price: 260 }], slots: { min: 3, max: 4 } };
    expect(weekStock(few, day(5), DAYS)).toEqual([{ itemId: 'star-string', price: 260 }]);
  });
});

describe('每週的購買紀錄', () => {
  it('週的起點是該週的週一（週五與週六同一個起點）', () => {
    expect(weekStartOf(day(5), DAYS)).toBe(1);
    expect(weekStartOf(day(6), DAYS)).toBe(1);
    expect(weekStartOf(day(12), DAYS)).toBe(8);
    expect(totalDay(day(13), DAYS)).toBe(13);
  });

  it('同一週的購買數量會累計，換週後歸零', () => {
    const log = { week: weekStartOf(day(5), DAYS), bought: { 'star-string': 2 } };
    expect(boughtThisWeek(log, day(6), DAYS)).toEqual({ 'star-string': 2 });
    expect(boughtThisWeek(log, day(12), DAYS)).toEqual({});
  });

  it('空的紀錄是空的', () => {
    expect(boughtThisWeek(emptyMerchantLog(), day(5), DAYS)).toEqual({});
  });
});
