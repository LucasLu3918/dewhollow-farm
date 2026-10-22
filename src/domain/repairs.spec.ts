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
/** 湖畔修復：八種不同的魚，每種各一條。 */
const LAKE_FISH = ['fish.carp', 'fish.crucian', 'fish.bass', 'fish.reed-catfish', 'fish.silver-minnow', 'fish.mossy-perch', 'fish.veil-bream', 'fish.pebble-loach'];
const LAKE_GOAL: RepairGoal = { type: 'kinds', pool: LAKE_FISH, count: 8, each: 1 };

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

const lake: RepairDef = {
  id: 'lake',
  season: 'summer',
  name: '湖畔修復',
  request: '請捐出八種不同的魚。',
  done: '橋修好了。',
  goal: LAKE_GOAL,
  reward: { gold: 400, flags: ['repair:lake-bridge'] },
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

describe('湖畔修復的目標：八種不同的魚，各 1 條（不再是種類不限的八條）', () => {
  it('八種魚各一條就完成；少一種不算', () => {
    const seven = Object.fromEntries(LAKE_FISH.slice(0, 7).map((id) => [id, 1]));
    expect(goalProgress(LAKE_GOAL, seven)).toEqual({ value: 7, target: 8 });
    expect(goalMet(LAKE_GOAL, seven)).toBe(false);
    expect(goalMet(LAKE_GOAL, { ...seven, 'fish.pebble-loach': 1 })).toBe(true);
  });

  it('同一種魚釣到好幾條也只算一種', () => {
    expect(goalProgress(LAKE_GOAL, { 'fish.carp': 5, 'fish.bass': 3 })).toEqual({ value: 2, target: 8 });
  });
});

describe('捐獻的上限與拒絕', () => {
  it('kinds：每種最多捐 each 件，已經完成就不再收', () => {
    expect(donationCap(KINDS_GOAL, {}, 'mushroom')).toBe(1);
    expect(donationCap(KINDS_GOAL, { mushroom: 1 }, 'mushroom')).toBe(0);
    expect(donationCap(KINDS_GOAL, {}, 'carp')).toBe(0);
  });

  it('湖畔修復：每種魚只能捐一條，不在八種裡的魚不收', () => {
    expect(donationCap(LAKE_GOAL, {}, 'fish.carp')).toBe(1);
    expect(donationCap(LAKE_GOAL, { 'fish.carp': 1 }, 'fish.carp')).toBe(0);
    expect(donationRefusal(lake, recordOf({}, 'lake', 1), 'fish.carp', 2)).toBe('REPAIR_ENOUGH');
    expect(donationRefusal(lake, recordOf({}, 'lake', 1), 'crop.moon-bean', 1)).toBe('NOT_REPAIR_ITEM');
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
