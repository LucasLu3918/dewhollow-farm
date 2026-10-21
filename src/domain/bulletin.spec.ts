import { describe, expect, it } from 'vitest';
import type { Calendar } from './calendar';
import { boardFor, drawBoard, EMPTY_BOARD, pickDistinct, type BulletinRules } from './bulletin';

const rules: BulletinRules = {
  postedBy: '鎮公所',
  dailyCount: 2,
  daily: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'],
  weekly: ['w1', 'w2', 'w3'],
};

function on(season: Calendar['season'], day: number, year = 1): Calendar {
  return { year, season, day, minuteOfDay: 360 };
}

describe('佈告欄的日期種子抽取（drawBoard）', () => {
  it('同一天抽到的委託完全一樣（可重現）', () => {
    expect(drawBoard(rules, on('spring', 5), 20)).toEqual(drawBoard(rules, on('spring', 5), 20));
  });

  it('每天抽出的數量正確、同一天不會重複，且都來自候選清單', () => {
    for (let day = 1; day <= 20; day += 1) {
      const board = drawBoard(rules, on('spring', day), 20);
      expect(board.daily).toHaveLength(2);
      expect(new Set(board.daily).size).toBe(2);
      for (const id of board.daily) expect(rules.daily).toContain(id);
    }
  });

  it('不同天的抽取會變化（春夏 40 天內不會全部一樣）', () => {
    const boards = new Set<string>();
    for (let day = 1; day <= 20; day += 1) boards.add(drawBoard(rules, on('spring', day), 20).daily.join(','));
    for (let day = 1; day <= 20; day += 1) boards.add(drawBoard(rules, on('summer', day), 20).daily.join(','));
    expect(boards.size).toBeGreaterThanOrEqual(15);
  });

  it('大委託在同一週內相同，換週才會換；跨年也一樣運作', () => {
    const weekOne = drawBoard(rules, on('spring', 1), 20).weekly;
    expect(drawBoard(rules, on('spring', 7), 20).weekly).toBe(weekOne);
    const weeklies = new Set<string | null>();
    for (let day = 1; day <= 80; day += 7) weeklies.add(drawBoard(rules, on('spring', day), 20).weekly);
    expect(weeklies.size).toBeGreaterThanOrEqual(2);
    expect(drawBoard(rules, on('winter', 20, 2), 20).weekly).not.toBeNull();
  });

  it('沒有大委託候選時，大委託為空', () => {
    expect(drawBoard({ ...rules, weekly: [] }, on('spring', 1), 20).weekly).toBeNull();
  });

  it('記錄抽取的總天數（day），供之後判斷是否要重抽', () => {
    expect(drawBoard(rules, on('spring', 1), 20).day).toBe(1);
    expect(drawBoard(rules, on('summer', 1), 20).day).toBe(21);
  });
});

describe('佈告欄的今日狀態（boardFor）', () => {
  it('狀態的日期與今天相同時沿用，不同時重抽', () => {
    const today = drawBoard(rules, on('spring', 3), 20);
    expect(boardFor(rules, today, on('spring', 3), 20)).toBe(today);
    expect(boardFor(rules, EMPTY_BOARD, on('spring', 3), 20)).toEqual(today);
    expect(boardFor(rules, today, on('spring', 4), 20)).toEqual(drawBoard(rules, on('spring', 4), 20));
  });
});

describe('pickDistinct', () => {
  it('抽出的 id 不重複，數量超過候選時只給候選的全部', () => {
    const picked = pickDistinct(42, ['a', 'b', 'c'], 5);
    expect(picked.sort()).toEqual(['a', 'b', 'c']);
    expect(new Set(pickDistinct(7, ['a', 'b', 'c', 'd'], 3)).size).toBe(3);
  });
});
