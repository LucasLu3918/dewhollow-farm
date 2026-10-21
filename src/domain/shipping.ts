import type { ItemStack, Quality } from './items';

export interface ShipBox {
  /** 放入出貨箱、尚未結算的物品；同物品同品質合併。 */
  entries: ItemStack[];
}

export function createShipBox(): ShipBox {
  return { entries: [] };
}

export function shipStack(box: ShipBox, stack: ItemStack): ShipBox {
  const same = box.entries.findIndex((e) => e.itemId === stack.itemId && e.quality === stack.quality);
  if (same === -1) return { entries: [...box.entries, { ...stack }] };
  return { entries: box.entries.map((e, i) => (i === same ? { ...e, count: e.count + stack.count } : e)) };
}

/** 睡醒時結算：依單價計算總金額並清空出貨箱。單價由呼叫端決定，規則層不知道價格表。 */
export function settleShipBox(
  box: ShipBox,
  priceOf: (itemId: string, quality: Quality) => number,
): { gold: number; box: ShipBox } {
  let gold = 0;
  for (const entry of box.entries) gold += priceOf(entry.itemId, entry.quality) * entry.count;
  return { gold, box: createShipBox() };
}
