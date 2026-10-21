import { describe, expect, it } from 'vitest';
import { canSpend, createEnergy, restore, trySpend } from './energy';

const MAX_ENERGY = 20;

describe('energy', () => {
  it('starts full', () => {
    expect(createEnergy(MAX_ENERGY)).toEqual({ current: MAX_ENERGY, max: MAX_ENERGY });
  });

  it('spends energy when enough is available', () => {
    const r = trySpend(createEnergy(MAX_ENERGY), 2);
    expect(r).toEqual({ ok: true, value: { current: MAX_ENERGY - 2, max: MAX_ENERGY } });
  });

  it('refuses to spend when energy is insufficient and leaves it unchanged', () => {
    const low = { current: 1, max: MAX_ENERGY };
    expect(canSpend(low, 2)).toBe(false);
    expect(trySpend(low, 2)).toEqual({ ok: false, reason: 'NOT_ENOUGH_ENERGY' });
  });

  it('restores to full', () => {
    expect(restore({ current: 3, max: MAX_ENERGY })).toEqual({ current: MAX_ENERGY, max: MAX_ENERGY });
  });
});
