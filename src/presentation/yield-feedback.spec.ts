import { describe, expect, it } from 'vitest';
import type { ItemStack } from '../domain/items';
import { gainedItems } from './yield-feedback';

const stack = (itemId: string, count: number, quality: ItemStack['quality'] = 'normal'): ItemStack => ({ itemId, count, quality });

describe('gainedItems', () => {
  it('reports the count gained for an item that was not in the bag before', () => {
    expect(gainedItems([], [stack('wood', 3)])).toEqual([{ itemId: 'wood', count: 3 }]);
  });

  it('reports only the difference when the item was already in the bag', () => {
    expect(gainedItems([stack('stone', 2)], [stack('stone', 7)])).toEqual([{ itemId: 'stone', count: 5 }]);
  });

  it('adds up several stacks of the same item, whatever their quality', () => {
    const before = [stack('wood', 1, 'normal'), stack('wood', 2, 'fine')];
    const after = [stack('wood', 4, 'normal'), stack('wood', 3, 'fine')];
    expect(gainedItems(before, after)).toEqual([{ itemId: 'wood', count: 4 }]);
  });

  it('ignores items that went down, such as ones sold or used up', () => {
    expect(gainedItems([stack('mint', 5), stack('stone', 1)], [stack('mint', 2)])).toEqual([]);
  });

  it('keeps the order in which the items first appear in the bag', () => {
    const before = [stack('wood', 1)];
    const after = [stack('wood', 1), stack('stone', 2), stack('mint', 1)];
    expect(gainedItems(before, after)).toEqual([
      { itemId: 'stone', count: 2 },
      { itemId: 'mint', count: 1 },
    ]);
  });
});
