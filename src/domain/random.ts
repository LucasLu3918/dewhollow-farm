/**
 * 可重現的隨機數（線性同餘產生器）。狀態存在 GameState 中，讀檔後結果一致。
 * 所有函式都是純函式，不讀取全域亂數，方便測試。
 */

export interface Roll {
  value: number;
  rng: number;
}

export function advanceRng(rng: number): number {
  return (Math.imul(rng, 1664525) + 1013904223) >>> 0;
}

/** 在 [min, max]（含兩端）之間均勻抽一個整數。 */
export function rollInt(rng: number, min: number, max: number): Roll {
  const next = advanceRng(rng);
  const span = max - min + 1;
  return { value: min + Math.floor((next / 2 ** 32) * span), rng: next };
}
