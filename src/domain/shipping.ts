export interface ShipBox {
  /** 放入出貨箱、尚未結算的作物數量，鍵為作物 id。 */
  items: Record<string, number>;
}

export function createShipBox(): ShipBox {
  return { items: {} };
}

export function shipCrop(box: ShipBox, cropId: string, count: number): ShipBox {
  return { items: { ...box.items, [cropId]: (box.items[cropId] ?? 0) + count } };
}

/** 睡醒時結算：依售價計算總金額並清空出貨箱。 */
export function settleShipBox(
  box: ShipBox,
  sellPriceOf: (cropId: string) => number,
): { gold: number; box: ShipBox } {
  let gold = 0;
  for (const [cropId, count] of Object.entries(box.items)) {
    gold += sellPriceOf(cropId) * count;
  }
  return { gold, box: createShipBox() };
}
