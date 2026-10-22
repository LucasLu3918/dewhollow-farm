import { describe, expect, it } from 'vitest';
import { shippedPack } from '../../../tests/sim/shipped-content';
import { legacyProblems, ratingProblems } from './legacy-content';
import { NO_RATING, type RatingRules } from '../../domain/rating';
import { NO_LEGACY } from '../../domain/legacy';

/** M6：農場評級與豐收重置、傳承的內容交叉參照（content/rating.json、content/legacy.json）。 */

const GOOD_RATING: RatingRules = {
  weights: { income: 0.5, collection: 0.25, friendship: 0.25 },
  incomeFull: 30000,
  grades: [
    { grade: 'S', min: 0.9 },
    { grade: 'A', min: 0.75 },
    { grade: 'B', min: 0.5 },
    { grade: 'C', min: 0 },
  ],
};

describe('農場評級的內容（rating.json）', () => {
  it('目前的內容沒有問題', () => {
    expect(ratingProblems(shippedPack.rating ?? NO_RATING)).toEqual([]);
    expect(legacyProblems(shippedPack)).toEqual([]);
  });

  it('權重加總不是 1 會被擋下', () => {
    const problems = ratingProblems({ ...GOOD_RATING, weights: { income: 0.5, collection: 0.25, friendship: 0.5 } });
    expect(problems.join('\n')).toMatch(/權重/);
  });

  it('門檻沒有由高到低、或最後一級不是 0，會被擋下', () => {
    expect(ratingProblems({ ...GOOD_RATING, grades: [{ grade: 'C', min: 0 }, { grade: 'S', min: 0.9 }] }).length).toBeGreaterThan(0);
    expect(ratingProblems({ ...GOOD_RATING, grades: [{ grade: 'S', min: 0.9 }, { grade: 'C', min: 0.1 }] }).length).toBeGreaterThan(0);
  });

  it('滿分的收入門檻必須是正數', () => {
    expect(ratingProblems({ ...GOOD_RATING, incomeFull: 0 }).length).toBeGreaterThan(0);
  });
});

describe('豐收重置與傳承的內容（legacy.json）', () => {
  it('清掉的建築旗標必須是店家賣的 building 或合成效果的旗標', () => {
    const legacy = shippedPack.legacy ?? NO_LEGACY;
    const broken = { ...shippedPack, legacy: { ...legacy, reset: { ...legacy.reset, resetFlags: ['house-wing', 'ghost'] } } };
    expect(legacyProblems(broken).join('\n')).toMatch(/ghost/);
  });

  it('傳承要求的章節必須存在於主線', () => {
    const legacy = shippedPack.legacy ?? NO_LEGACY;
    const broken = { ...shippedPack, legacy: { ...legacy, legacy: { ...legacy.legacy, requiresChapter: 99 } } };
    expect(legacyProblems(broken).join('\n')).toMatch(/第 99 章/);
  });

  it('豐收重置從第 2 年起，不能更早', () => {
    const legacy = shippedPack.legacy ?? NO_LEGACY;
    const broken = { ...shippedPack, legacy: { ...legacy, reset: { ...legacy.reset, fromYear: 1 } } };
    expect(legacyProblems(broken).join('\n')).toMatch(/第 2 年/);
  });

  it('預設名字必須是 1 至 8 個字', () => {
    const legacy = shippedPack.legacy ?? NO_LEGACY;
    const broken = { ...shippedPack, legacy: { ...legacy, defaultPlayerName: '' } };
    expect(legacyProblems(broken).length).toBeGreaterThan(0);
  });

  it('地圖上至少要有一個傳承與重置的公告（notice: legacy）', () => {
    const houses = shippedPack.maps.filter((m) => m.id.startsWith('house'));
    for (const map of houses) {
      expect(Object.values(map.legend).some((tile) => tile.notice === 'legacy'), map.id).toBe(true);
    }
  });
});
