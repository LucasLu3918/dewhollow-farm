import type { ItemStack } from '../domain/items';

/**
 * 採集的產量回饋（純函式，不依賴 Phaser）：砍樹、挖礦、採集之後，在那一格飄出「+數量 名稱」。
 * 只看背包前後的差額，不改任何規則；產量本身仍由應用層的指令決定。
 */

export interface GainedItem {
  itemId: string;
  count: number;
}

/** 背包變多的物品與增加的數量（同一種物品的不同品質會加總）；減少的物品不列出，依第一次出現的順序排列。 */
export function gainedItems(before: readonly ItemStack[], after: readonly ItemStack[]): GainedItem[] {
  const totals = (stacks: readonly ItemStack[]): Map<string, number> => {
    const sums = new Map<string, number>();
    for (const stack of stacks) sums.set(stack.itemId, (sums.get(stack.itemId) ?? 0) + stack.count);
    return sums;
  };
  const was = totals(before);
  const now = totals(after);
  const gained: GainedItem[] = [];
  for (const [itemId, count] of now) {
    const delta = count - (was.get(itemId) ?? 0);
    if (delta > 0) gained.push({ itemId, count: delta });
  }
  return gained;
}
