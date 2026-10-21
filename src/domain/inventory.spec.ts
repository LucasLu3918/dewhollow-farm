import { describe, expect, it } from 'vitest';
import { addItem, countOf, createInventory, removeItem, takeMatching } from './inventory';

const radish = { id: 'crop.sweet-radish', maxStack: 10 };
const bean = { id: 'crop.moon-bean', maxStack: 10 };

describe('inventory', () => {
  it('starts empty with the given capacity', () => {
    expect(createInventory(4)).toEqual({ capacity: 4, stacks: [] });
  });

  it('adds items as a normal-quality stack', () => {
    const added = addItem(createInventory(4), radish, 3);
    expect(added).toEqual({
      ok: true,
      value: { capacity: 4, stacks: [{ itemId: 'crop.sweet-radish', quality: 'normal', count: 3 }] },
    });
  });

  it('merges into an existing stack and spills the rest into a new one', () => {
    let inv = createInventory(4);
    inv = unwrap(addItem(inv, radish, 8));
    inv = unwrap(addItem(inv, radish, 5));
    expect(inv.stacks).toEqual([
      { itemId: 'crop.sweet-radish', quality: 'normal', count: 10 },
      { itemId: 'crop.sweet-radish', quality: 'normal', count: 3 },
    ]);
  });

  it('keeps different qualities in separate stacks', () => {
    let inv = createInventory(4);
    inv = unwrap(addItem(inv, radish, 2, 'normal'));
    inv = unwrap(addItem(inv, radish, 2, 'fine'));
    expect(inv.stacks).toHaveLength(2);
    expect(countOf(inv, 'crop.sweet-radish')).toBe(4);
  });

  it('refuses to add when the bag has no room and leaves it unchanged', () => {
    const inv = unwrap(addItem(createInventory(1), radish, 10));
    expect(addItem(inv, bean, 1)).toEqual({ ok: false, reason: 'BAG_FULL' });
    expect(addItem(inv, radish, 1)).toEqual({ ok: false, reason: 'BAG_FULL' });
    expect(inv.stacks).toEqual([{ itemId: 'crop.sweet-radish', quality: 'normal', count: 10 }]);
  });

  it('adds nothing at all when only part of the amount would fit', () => {
    const inv = unwrap(addItem(createInventory(1), radish, 5));
    expect(addItem(inv, radish, 6)).toEqual({ ok: false, reason: 'BAG_FULL' });
    expect(unwrap(addItem(inv, radish, 5)).stacks[0]?.count).toBe(10);
  });

  it('does not mutate the inventory it was given', () => {
    const inv = createInventory(2);
    addItem(inv, radish, 3);
    expect(inv.stacks).toEqual([]);
  });

  it('rejects non-positive or fractional counts as a programming error', () => {
    expect(() => addItem(createInventory(2), radish, 0)).toThrow(RangeError);
    expect(() => addItem(createInventory(2), radish, 1.5)).toThrow(RangeError);
    expect(() => removeItem(createInventory(2), radish.id, -1)).toThrow(RangeError);
  });

  it('removes across stacks and drops emptied stacks', () => {
    let inv = createInventory(4);
    inv = unwrap(addItem(inv, radish, 15)); // 10 + 5
    inv = unwrap(removeItem(inv, radish.id, 7));
    expect(inv.stacks).toEqual([{ itemId: 'crop.sweet-radish', quality: 'normal', count: 8 }]);
    inv = unwrap(removeItem(inv, radish.id, 8));
    expect(inv.stacks).toEqual([]);
  });

  it('refuses to remove more than it holds and leaves it unchanged', () => {
    const inv = unwrap(addItem(createInventory(4), radish, 2));
    expect(removeItem(inv, radish.id, 3)).toEqual({ ok: false, reason: 'NOT_ENOUGH' });
    expect(removeItem(inv, radish.id, 1, 'fine')).toEqual({ ok: false, reason: 'NOT_ENOUGH' });
  });

  it('takes every stack that matches a predicate', () => {
    let inv = createInventory(4);
    inv = unwrap(addItem(inv, radish, 2));
    inv = unwrap(addItem(inv, bean, 3));
    const { inventory, taken } = takeMatching(inv, (stack) => stack.itemId === bean.id);
    expect(taken).toEqual([{ itemId: 'crop.moon-bean', quality: 'normal', count: 3 }]);
    expect(inventory.stacks).toEqual([{ itemId: 'crop.sweet-radish', quality: 'normal', count: 2 }]);
  });
});

function unwrap<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(`unexpected failure: ${result.reason}`);
  return result.value;
}
