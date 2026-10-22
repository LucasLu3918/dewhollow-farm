import { describe, expect, it } from 'vitest';
import type { Calendar } from './calendar';
import {
  donationCap,
  donationRefusal,
  goalMet,
  goalProgress,
  recordDonation,
  recordOf,
  seasonOpen,
  type RepairDef,
  type RepairGoal,
} from './repairs';

const FLOWERS = ['mushroom', 'berry', 'flower-spring', 'flower-summer', 'herb', 'fern-shoot', 'flower-bell', 'creek-celery', 'flower-night', 'pine-nut'];
const KINDS_GOAL: RepairGoal = { type: 'kinds', pool: FLOWERS, count: 10, each: 1 };
const TOTAL_GOAL: RepairGoal = { type: 'total', pool: ['fish.carp', 'fish.crucian', 'fish.bass'], count: 8 };

const garden: RepairDef = {
  id: 'garden',
  season: 'spring',
  name: '花園修復',
  request: '請捐出花與野菜。',
  done: '花園亮起來了。',
  goal: KINDS_GOAL,
  reward: { gold: 300, flags: ['repair:garden'] },
  playMinutes: 10,
};

function at(season: Calendar['season'], day = 3, year = 1): Calendar {
  return { year, season, day, minuteOfDay: 600 };
}

describe('修復目標的進度（kinds：不同種類各捐到 each 件）', () => {
  it('每種至少 each 件才算這一種完成；種數達到 count 就完成', () => {
    const nine = Object.fromEntries(FLOWERS.slice(0, 9).map((id) => [id, 1]));
    expect(goalProgress(KINDS_GOAL, nine)).toEqual({ value: 9, target: 10 });
    expect(goalMet(KINDS_GOAL, nine)).toBe(false);
    expect(goalMet(KINDS_GOAL, { ...nine, 'pine-nut': 1 })).toBe(true);
  });

  it('同一種捐再多也只算一種', () => {
    expect(goalProgress(KINDS_GOAL, { mushroom: 5 })).toEqual({ value: 1, target: 10 });
  });

  it('不在候選清單裡的東西不算', () => {
    expect(goalProgress(KINDS_GOAL, { 'crop.moon-bean': 3 })).toEqual({ value: 0, target: 10 });
  });
});

describe('修復目標的進度（total：候選清單裡的東西加總到 count）', () => {
  it('種類不限，加總到 count 就完成', () => {
    expect(goalMet(TOTAL_GOAL, { 'fish.carp': 3, 'fish.bass': 4 })).toBe(false);
    expect(goalMet(TOTAL_GOAL, { 'fish.carp': 3, 'fish.bass': 3, 'fish.crucian': 2 })).toBe(true);
    expect(goalProgress(TOTAL_GOAL, { 'fish.carp': 3, 'fish.bass': 3, 'fish.crucian': 2 })).toEqual({ value: 8, target: 8 });
  });
});

describe('捐獻的上限與拒絕', () => {
  it('kinds：每種最多捐 each 件，已經完成就不再收', () => {
    expect(donationCap(KINDS_GOAL, {}, 'mushroom')).toBe(1);
    expect(donationCap(KINDS_GOAL, { mushroom: 1 }, 'mushroom')).toBe(0);
    expect(donationCap(KINDS_GOAL, {}, 'carp')).toBe(0);
  });

  it('total：只能捐到還差的數量', () => {
    expect(donationCap(TOTAL_GOAL, { 'fish.carp': 5 }, 'fish.carp')).toBe(3);
    expect(donationCap(TOTAL_GOAL, { 'fish.carp': 5, 'fish.bass': 3 }, 'fish.bass')).toBe(0);
  });

  it('不在季節內、已完成、不在候選、超過上限的捐獻都被拒絕，並給出失敗代碼', () => {
    const record = recordOf({}, 'garden', 1);
    expect(donationRefusal(garden, record, 'mushroom', 1)).toBeNull();
    expect(donationRefusal(garden, record, 'mushroom', 2)).toBe('REPAIR_ENOUGH');
    expect(donationRefusal(garden, record, 'fish.carp', 1)).toBe('NOT_REPAIR_ITEM');
    expect(donationRefusal(garden, { ...record, done: true }, 'mushroom', 1)).toBe('REPAIR_DONE');
    expect(donationRefusal(garden, record, 'mushroom', 0)).toBe('BAD_COUNT');
  });
});

describe('修復紀錄與季節', () => {
  it('紀錄分年：跨年的舊紀錄視為沒有捐過', () => {
    const lastYear = recordDonation(recordOf({}, 'garden', 1), 'mushroom', 1);
    expect(recordOf({ garden: lastYear }, 'garden', 1).donated).toEqual({ mushroom: 1 });
    expect(recordOf({ garden: lastYear }, 'garden', 2)).toEqual({ year: 2, donated: {}, done: false });
  });

  it('只有修復目標所屬的季節開放', () => {
    expect(seasonOpen(garden, at('spring'))).toBe(true);
    expect(seasonOpen(garden, at('summer'))).toBe(false);
  });
});
