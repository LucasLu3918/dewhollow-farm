import type { ItemStack, Quality } from './items';
import { fail, ok, type Result } from './result';

export interface Inventory {
  /** 格子數；每一疊佔一格。 */
  capacity: number;
  stacks: ItemStack[];
}

export function createInventory(capacity: number): Inventory {
  return { capacity, stacks: [] };
}

function assertCount(count: number): void {
  if (!Number.isInteger(count) || count <= 0) throw new RangeError(`數量必須是正整數：${count}`);
}

/**
 * 加入物品：先補滿同物品同品質的未滿堆疊，再開新格。
 * 放不下時整筆失敗、背包不變，不會只放入一部分。
 */
export function addItem(
  inventory: Inventory,
  item: { id: string; maxStack: number },
  count: number,
  quality: Quality = 'normal',
): Result<Inventory, 'BAG_FULL'> {
  assertCount(count);
  let remaining = count;
  const stacks = inventory.stacks.map((stack) => {
    if (remaining === 0 || stack.itemId !== item.id || stack.quality !== quality) return stack;
    const room = item.maxStack - stack.count;
    if (room <= 0) return stack;
    const moved = Math.min(room, remaining);
    remaining -= moved;
    return { ...stack, count: stack.count + moved };
  });

  while (remaining > 0) {
    if (stacks.length >= inventory.capacity) return fail('BAG_FULL');
    const moved = Math.min(item.maxStack, remaining);
    stacks.push({ itemId: item.id, quality, count: moved });
    remaining -= moved;
  }
  return ok({ ...inventory, stacks });
}

/** 取出指定數量；從後面的堆疊先扣。不足時整筆失敗、背包不變。 */
export function removeItem(
  inventory: Inventory,
  itemId: string,
  count: number,
  quality: Quality = 'normal',
): Result<Inventory, 'NOT_ENOUGH'> {
  assertCount(count);
  const held = inventory.stacks
    .filter((s) => s.itemId === itemId && s.quality === quality)
    .reduce((sum, s) => sum + s.count, 0);
  if (held < count) return fail('NOT_ENOUGH');

  let remaining = count;
  const stacks = [...inventory.stacks];
  for (let i = stacks.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const stack = stacks[i];
    if (!stack || stack.itemId !== itemId || stack.quality !== quality) continue;
    const taken = Math.min(stack.count, remaining);
    remaining -= taken;
    stacks[i] = { ...stack, count: stack.count - taken };
  }
  return ok({ ...inventory, stacks: stacks.filter((s) => s.count > 0) });
}

/** 某個物品的總數量（所有品質合計）。 */
export function countOf(inventory: Inventory, itemId: string): number {
  return inventory.stacks.filter((s) => s.itemId === itemId).reduce((sum, s) => sum + s.count, 0);
}

/** 取出所有符合條件的堆疊，例如出貨時取走全部可出貨的物品。 */
export function takeMatching(
  inventory: Inventory,
  predicate: (stack: ItemStack) => boolean,
): { inventory: Inventory; taken: ItemStack[] } {
  const taken = inventory.stacks.filter(predicate);
  return { inventory: { ...inventory, stacks: inventory.stacks.filter((s) => !predicate(s)) }, taken };
}
