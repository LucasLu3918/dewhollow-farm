import { describe, expect, it } from 'vitest';
import { fertilizedSkillTuning } from './fertilizer';
import { qualityFor } from './skills';

const SKILLS = {
  thresholds: [0, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650],
  xp: {},
  bonusFrom: 5,
  goodFrom: 4,
  goodChance: 0.2,
  fineFrom: 8,
  fineChance: 0.08,
};
const FERTILIZER = {
  basic: { goodBonus: 20, fineBonus: 0 },
  fine: { goodBonus: 30, fineBonus: 15 },
};

describe('fertilizer and harvest quality (肥料與收成品質)', () => {
  it('no fertilizer leaves the chances as they are', () => {
    expect(fertilizedSkillTuning(SKILLS, undefined, FERTILIZER)).toEqual(SKILLS);
  });

  it('basic fertilizer raises only the chance of a good harvest', () => {
    const tuned = fertilizedSkillTuning(SKILLS, 'basic', FERTILIZER);
    expect(tuned.goodChance).toBeCloseTo(0.4);
    expect(tuned.fineChance).toBe(0.08);
  });

  it('fine fertilizer raises both the good and the fine chance', () => {
    const tuned = fertilizedSkillTuning(SKILLS, 'fine', FERTILIZER);
    expect(tuned.goodChance).toBeCloseTo(0.5);
    expect(tuned.fineChance).toBeCloseTo(0.23);
  });

  it('a roll that would have been normal becomes good with basic fertilizer at farming level 4', () => {
    expect(qualityFor(4, 0.3, SKILLS)).toBe('normal');
    expect(qualityFor(4, 0.3, fertilizedSkillTuning(SKILLS, 'basic', FERTILIZER))).toBe('good');
  });
});
