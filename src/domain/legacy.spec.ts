import { describe, expect, it } from 'vitest';
import { cropPriceBonusPercent, legacyRefusal, normalizePlayerName, resetRefusal, resetWindowOpen, type LegacyRules } from './legacy';

const RULES: LegacyRules = {
  defaultPlayerName: '小涵',
  reset: {
    fromYear: 2,
    windowSeason: 'spring',
    windowDay: 1,
    bonusPercentPerReset: 5,
    maxResets: 3,
    resetFlags: ['house-wing'],
  },
  legacy: { requiresChapter: 5 },
};

const morning = (year: number, season: 'spring' | 'summer' | 'autumn' | 'winter', day: number) => ({
  year,
  season,
  day,
  minuteOfDay: 360,
});

describe('豐收重置的時機（第 2 年起的春季第 1 天，換年後、睡前）', () => {
  it('第 2 年春季第 1 天開著', () => {
    expect(resetWindowOpen(morning(2, 'spring', 1), RULES.reset)).toBe(true);
  });

  it('第 1 年關著；第 2 年的其他日子也關著', () => {
    expect(resetWindowOpen(morning(1, 'spring', 1), RULES.reset)).toBe(false);
    expect(resetWindowOpen(morning(2, 'spring', 2), RULES.reset)).toBe(false);
    expect(resetWindowOpen(morning(2, 'summer', 1), RULES.reset)).toBe(false);
    expect(resetWindowOpen(morning(2, 'winter', 20), RULES.reset)).toBe(false);
  });

  it('時機關著時拒絕，原因是 RESET_CLOSED', () => {
    expect(resetRefusal({ calendar: morning(1, 'spring', 1), resetBonus: 0 }, RULES.reset)).toBe('RESET_CLOSED');
  });

  it('已經做滿 maxResets 次後拒絕，原因是 RESET_LIMIT', () => {
    expect(resetRefusal({ calendar: morning(2, 'spring', 1), resetBonus: 3 }, RULES.reset)).toBe('RESET_LIMIT');
  });

  it('時機開著、次數還沒滿時可以做（回傳 null）', () => {
    expect(resetRefusal({ calendar: morning(2, 'spring', 1), resetBonus: 2 }, RULES.reset)).toBeNull();
  });
});

describe('傳承的條件（主線第 5 章完成）', () => {
  it('還在第 5 章（第 5 章沒完成）就拒絕', () => {
    expect(legacyRefusal({ story: { chapter: 5 } }, RULES)).toBe('LEGACY_LOCKED');
  });

  it('第 5 章完成（主線已經到第 6 章）就可以', () => {
    expect(legacyRefusal({ story: { chapter: 6 } }, RULES)).toBeNull();
  });
});

describe('新角色的名字', () => {
  it('去掉前後空白後保留', () => {
    expect(normalizePlayerName('  小禾 ')).toBe('小禾');
  });

  it('空白與超過 8 個字的名字不合法', () => {
    expect(normalizePlayerName('')).toBeNull();
    expect(normalizePlayerName('   ')).toBeNull();
    expect(normalizePlayerName('一二三四五六七八九')).toBeNull();
  });

  it('剛好 8 個字是合法的（以字元計，不是以位元組計）', () => {
    expect(normalizePlayerName('一二三四五六七八')).toBe('一二三四五六七八');
  });
});

describe('豐收重置的作物售價加成', () => {
  it('每次換取 bonusPercentPerReset%，次數為 0 時沒有加成', () => {
    expect(cropPriceBonusPercent(0, RULES.reset)).toBe(0);
    expect(cropPriceBonusPercent(2, RULES.reset)).toBe(10);
    expect(cropPriceBonusPercent(3, RULES.reset)).toBe(15);
  });
});
