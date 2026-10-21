import { describe, expect, it } from 'vitest';
import { biteChanceFor } from './fishing';

const BASE = { biteChance: 60, bobberBonus: 10, baitBonus: 20 };

describe('bite chance (魚上鉤機率)', () => {
  it('is the base chance with no bobber and no bait', () => {
    expect(biteChanceFor(BASE, { bobber: false, bait: false })).toBe(60);
  });

  it('a bobber adds its bonus, and a bait used on this cast adds the bait bonus', () => {
    expect(biteChanceFor(BASE, { bobber: true, bait: false })).toBe(70);
    expect(biteChanceFor(BASE, { bobber: false, bait: true })).toBe(80);
    expect(biteChanceFor(BASE, { bobber: true, bait: true })).toBe(90);
  });

  it('never goes above 100 percent', () => {
    expect(biteChanceFor({ biteChance: 95, bobberBonus: 10, baitBonus: 20 }, { bobber: true, bait: true })).toBe(100);
  });
});
