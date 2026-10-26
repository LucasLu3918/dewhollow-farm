import { describe, expect, it } from 'vitest';
import { createInventory, addItem } from '../domain/inventory';
import { createNewGame } from '../domain/game-state';
import { shippedIndex, shippedPack } from '../../tests/sim/shipped-content';
import { inventoryDisplay } from './inventory-display';

function inventoryWith(itemId: string, quality: 'normal' | 'good' | 'fine' = 'normal') {
  let inventory = createInventory(10);
  const stored = addItem(inventory, shippedIndex.item(itemId), 2, quality);
  if (!stored.ok) throw new Error('背包放不下測試物品');
  inventory = stored.value;
  return inventory;
}

describe('inventoryDisplay', () => {
  it('maps all supported item kinds to their display categories', () => {
    const entries = [
      ['seed.dew-grass', '種子'],
      ['crop.dew-grass', '作物'],
      ['wood', '材料'],
      ['mint', '採集'],
      ['silver-ore', '礦石'],
      ['fish.carp', '魚類'],
      ['egg', '動物產物'],
      [`dish.${shippedPack.recipes[0]!.id}`, '料理'],
      ['cheese', '加工品'],
      ['vase', '合成品'],
      ['building.cowbarn', '建築改建'],
      ['night-canvas', '裝飾'],
      ['recipe.sun-hat', '配方'],
    ] as const;

    for (const [itemId, category] of entries) {
      expect(inventoryDisplay(inventoryWith(itemId), shippedIndex)[0]?.category, itemId).toBe(category);
    }
  });

  it('returns the content name, stack count, and quality for the held item', () => {
    const item = shippedIndex.item('crop.dew-grass');
    expect(inventoryDisplay(inventoryWith(item.id, 'good'), shippedIndex)).toEqual([
      expect.objectContaining({ itemId: item.id, name: item.name, category: '作物', count: 2, quality: 'good' }),
    ]);
  });

  it.each([
    ['normal', 54],
    ['good', 68],
    ['fine', 81],
  ] as const)('uses the domain quality price for %s quality crops', (quality, sellPrice) => {
    const entry = inventoryDisplay(inventoryWith('crop.moon-bean', quality), shippedIndex)[0];
    expect(entry?.sellPrice).toBe(sellPrice);
  });

  it('omits the sell price for items without a sellPrice', () => {
    const entry = inventoryDisplay(inventoryWith('wood', 'fine'), shippedIndex)[0];
    expect(entry).not.toHaveProperty('sellPrice');
    expect(entry?.sellabilityLabel).toBe('不可出貨');
  });

  it('fails explicitly when an inventory stack references an unknown item', () => {
    const state = createNewGame(shippedPack, 7);
    const inventory = { ...state.inventory, stacks: [{ itemId: 'missing-item', quality: 'normal' as const, count: 1 }] };
    expect(() => inventoryDisplay(inventory, shippedIndex)).toThrow('找不到物品：missing-item');
  });

  it('lists only uses supported by the indexed content', () => {
    const entry = inventoryDisplay(inventoryWith('wood'), shippedIndex)[0];
    expect(entry?.uses).toContain('合成：木柵欄');
    expect(entry?.uses).not.toContain('攻擊力');
  });
});
