import { describe, expect, it } from 'vitest';
import { cropItemId, cropItems, DEFAULT_MAX_STACK, seedItemId } from './items';

const crops = [
  { id: 'sweet-radish', name: '甜蘿蔔', seedPrice: 25, growthDays: 3, seasons: ['spring' as const] },
  { id: 'moon-bean', name: '月光豆', seedPrice: 15, growthDays: 2, seasons: ['spring' as const] },
];

describe('items', () => {
  it('names item ids after the crop and its role', () => {
    expect(seedItemId('moon-bean')).toBe('seed.moon-bean');
    expect(cropItemId('moon-bean')).toBe('crop.moon-bean');
  });

  it('derives a seed and a produce item for every crop', () => {
    const items = cropItems(crops);
    expect(items.map((i) => i.id)).toEqual([
      'seed.sweet-radish',
      'crop.sweet-radish',
      'seed.moon-bean',
      'crop.moon-bean',
    ]);
  });

  it('makes seeds unsellable and produce sellable at the existing price formula', () => {
    const [seed, produce] = cropItems(crops);
    expect(seed).toMatchObject({ kind: 'seed', name: '甜蘿蔔種子', cropId: 'sweet-radish', maxStack: DEFAULT_MAX_STACK });
    expect(seed?.sellPrice).toBeUndefined();
    expect(produce).toMatchObject({ kind: 'crop', name: '甜蘿蔔', cropId: 'sweet-radish', sellPrice: 98 }); // 25 × 3 × 1.3
  });
});
