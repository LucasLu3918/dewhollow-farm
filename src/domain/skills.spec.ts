import { describe, expect, it } from 'vitest';
import { bonusYield, levelOf, MAX_LEVEL, qualityFor, SKILL_IDS, skillOfAction } from './skills';

const THRESHOLDS = [0, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650];
const TUNING = { goodFrom: 4, goodChance: 0.2, fineFrom: 8, fineChance: 0.08, bonusFrom: 5 };

describe('skill levels', () => {
  it('a level is reached when its xp threshold is met, and tops out at 10', () => {
    expect(levelOf(0, THRESHOLDS)).toBe(0);
    expect(levelOf(19, THRESHOLDS)).toBe(0);
    expect(levelOf(20, THRESHOLDS)).toBe(1);
    expect(levelOf(540, THRESHOLDS)).toBe(9);
    expect(levelOf(999999, THRESHOLDS)).toBe(MAX_LEVEL);
    expect(MAX_LEVEL).toBe(10);
  });

  it('has the five skills of the design', () => {
    expect([...SKILL_IDS]).toEqual(['farming', 'foraging', 'fishing', 'mining', 'cooking']);
  });
});

describe('which skill an action trains', () => {
  it('farming for tilling, watering, planting and harvesting; foraging for trees and wild plants; mining for rocks', () => {
    expect(skillOfAction('till')).toBe('farming');
    expect(skillOfAction('water')).toBe('farming');
    expect(skillOfAction('plant')).toBe('farming');
    expect(skillOfAction('harvest')).toBe('farming');
    expect(skillOfAction('chop')).toBe('foraging');
    expect(skillOfAction('forage')).toBe('foraging');
    expect(skillOfAction('mine')).toBe('mining');
  });

  it('shipping trains nothing', () => {
    expect(skillOfAction('ship')).toBeNull();
  });
});

describe('the level bonus', () => {
  it('gives one extra item from level 5 on, and nothing before', () => {
    expect(bonusYield(4, TUNING)).toBe(0);
    expect(bonusYield(5, TUNING)).toBe(1);
    expect(bonusYield(10, TUNING)).toBe(1);
  });
});

describe('crop quality', () => {
  it('a low farmer never makes good crops', () => {
    for (const r of [0, 0.1, 0.5, 0.99]) expect(qualityFor(3, r, TUNING)).toBe('normal');
  });

  it('from level 4 a small share is good, from level 8 a small share is fine', () => {
    expect(qualityFor(4, 0.1, TUNING)).toBe('good');
    expect(qualityFor(4, 0.5, TUNING)).toBe('normal');
    expect(qualityFor(7, 0.05, TUNING)).toBe('good');
    expect(qualityFor(8, 0.05, TUNING)).toBe('fine');
    expect(qualityFor(8, 0.12, TUNING)).toBe('good');
    expect(qualityFor(8, 0.3, TUNING)).toBe('normal');
  });
});
