import type { ItemStack } from '../domain/items';

/**
 * 出貨的動畫參數與純函式（不依賴 Phaser）：物品飛進出貨箱、箱蓋開合一次。
 * 只影響畫面；出貨的規則與結算都在應用層與 domain，這裡不改任何數值。
 */

/** 一件物品從玩家飛到出貨箱的時間（毫秒）。 */
export const SHIP_FLIGHT_MS = 360;
/** 同時飛出的物品種類最多幾種；多出來的種類不畫，照常出貨。 */
export const SHIP_MAX_ICONS = 3;
/** 每種物品之間的間隔（毫秒），讓它們一種接一種飛進去。 */
export const SHIP_ICON_STAGGER_MS = 70;
/** 箱蓋開到最大所需的時間（毫秒）。 */
export const SHIP_LID_OPEN_MS = 180;
/** 箱蓋關上所需的時間（毫秒）。 */
export const SHIP_LID_CLOSE_MS = 240;
/** 箱蓋保持打開，直到最後一種物品落地。 */
export const SHIP_HOLD_END_MS = SHIP_FLIGHT_MS + SHIP_ICON_STAGGER_MS * (SHIP_MAX_ICONS - 1);
/** 整段箱蓋動畫的長度（毫秒）。 */
export const SHIP_LID_TOTAL_MS = SHIP_HOLD_END_MS + SHIP_LID_CLOSE_MS;
/** 箱蓋全開時的旋轉角度（弧度）；負值是逆時針，蓋子往上翻開。 */
export const SHIP_LID_OPEN_ANGLE = -2.4;

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 第 ms 毫秒時箱蓋開了多少（0 為關上，1 為全開）。 */
export function lidOpenness(ms: number): number {
  if (!(ms >= 0 && ms <= SHIP_LID_TOTAL_MS)) {
    throw new RangeError(`箱蓋動畫的時間必須在 0 到 ${SHIP_LID_TOTAL_MS} 毫秒之間：${ms}`);
  }
  if (ms < SHIP_LID_OPEN_MS) return smoothstep(ms / SHIP_LID_OPEN_MS);
  if (ms <= SHIP_HOLD_END_MS) return 1;
  return 1 - smoothstep((ms - SHIP_HOLD_END_MS) / SHIP_LID_CLOSE_MS);
}

/** 第 ms 毫秒時箱蓋的旋轉角度（弧度）。關上時回傳正的 0，不是 -0。 */
export function lidAngle(ms: number): number {
  const angle = lidOpenness(ms) * SHIP_LID_OPEN_ANGLE;
  return angle === 0 ? 0 : angle;
}

/** 第 index 種物品開始飛的延遲（毫秒）。 */
export function shipIconDelay(index: number): number {
  return index * SHIP_ICON_STAGGER_MS;
}

/** 這次要畫出來飛的物品種類（超過上限的不畫）。 */
export function shipIconsFor(itemIds: readonly string[]): string[] {
  return itemIds.slice(0, SHIP_MAX_ICONS);
}

/**
 * 出貨前後背包的差：總數量變少的物品 id（同一物品不論品質合計，每種只列一次，依背包原本的順序）。
 * 出貨只會減少背包，所以數量增加的物品不列入。
 */
export function shippedItemIds(before: readonly ItemStack[], after: readonly ItemStack[]): string[] {
  const totals = (stacks: readonly ItemStack[]): Map<string, number> => {
    const sums = new Map<string, number>();
    for (const stack of stacks) sums.set(stack.itemId, (sums.get(stack.itemId) ?? 0) + stack.count);
    return sums;
  };
  const was = totals(before);
  const now = totals(after);
  const ids: string[] = [];
  for (const [itemId, count] of was) {
    if ((now.get(itemId) ?? 0) < count) ids.push(itemId);
  }
  return ids;
}
