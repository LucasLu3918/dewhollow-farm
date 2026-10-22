import { describe, expect, it } from 'vitest';
import type { ShopDef } from './content';
import { onSale, stockFor } from './shop-stock';

const general: ShopDef = {
  id: 'general',
  name: '雜貨店',
  stock: [
    { itemId: 'hay', price: 5 },
    { itemId: 'seed.golden-rice', price: 50, seasons: ['autumn'] },
    { itemId: 'recipe.sun-hat', price: 180, seasons: ['summer'] },
    { itemId: 'wood', price: 12, seasons: ['autumn'] },
  ],
  upgrades: [],
};

describe('seasonal stock (上架與下架)', () => {
  it('a line with no seasons is on sale all year', () => {
    expect(onSale({ itemId: 'hay', price: 5 }, 'winter')).toBe(true);
  });

  it('a seasonal line is on sale only in its season', () => {
    const line = { itemId: 'recipe.sun-hat', price: 180, seasons: ['summer' as const] };
    expect(onSale(line, 'summer')).toBe(true);
    expect(onSale(line, 'autumn')).toBe(false);
  });

  it('the shelf changes with the season: the summer recipe comes off and the autumn wood goes on', () => {
    const summer = stockFor(general, 'summer').map((l) => l.itemId);
    const autumn = stockFor(general, 'autumn').map((l) => l.itemId);
    expect(summer).toEqual(['hay', 'recipe.sun-hat']);
    expect(autumn).toEqual(['hay', 'seed.golden-rice', 'wood']);
  });

  it('a season with nothing seasonal keeps the all-year lines only', () => {
    expect(stockFor(general, 'spring').map((l) => l.itemId)).toEqual(['hay']);
  });
});
