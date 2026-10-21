import { describe, expect, it } from 'vitest';
import { addCrop, addSeeds, createBag, removeSeed } from './bag';

describe('bag', () => {
  it('starts empty', () => {
    expect(createBag()).toEqual({ seeds: {}, crops: {} });
  });

  it('adds seeds and crops by id', () => {
    const bag = addCrop(addSeeds(createBag(), 'sweet-radish', 5), 'sweet-radish', 2);
    expect(bag.seeds['sweet-radish']).toBe(5);
    expect(bag.crops['sweet-radish']).toBe(2);
  });

  it('removes one seed and drops the key when it reaches zero', () => {
    const bag = addSeeds(createBag(), 'moon-bean', 1);
    expect(removeSeed(bag, 'moon-bean')).toEqual({ ok: true, value: { seeds: {}, crops: {} } });
  });

  it('refuses to remove a seed that is not in the bag', () => {
    expect(removeSeed(createBag(), 'moon-bean')).toEqual({ ok: false, reason: 'NO_SEED' });
  });
});
