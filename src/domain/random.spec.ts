import { describe, expect, it } from 'vitest';
import { advanceRng, rollInt } from './random';

describe('rollInt', () => {
  it('stays within the inclusive range', () => {
    let rng = 42;
    for (let i = 0; i < 500; i += 1) {
      const roll = rollInt(rng, 1, 5);
      expect(roll.value).toBeGreaterThanOrEqual(1);
      expect(roll.value).toBeLessThanOrEqual(5);
      rng = roll.rng;
    }
  });

  it('is reproducible from the same seed', () => {
    expect(rollInt(7, 1, 5)).toEqual(rollInt(7, 1, 5));
  });

  it('covers every value over many rolls', () => {
    let rng = 2026;
    const seen = new Set<number>();
    for (let i = 0; i < 400; i += 1) {
      const roll = rollInt(rng, 1, 5);
      seen.add(roll.value);
      rng = roll.rng;
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('advances the state on every call', () => {
    expect(advanceRng(1)).not.toBe(1);
  });
});
