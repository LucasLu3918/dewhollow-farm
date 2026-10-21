/**
 * 釣星星（夜市的夜釣小遊戲）的時機判斷。純函式：時間由畫面量測後傳進來，規則只看數字。
 * 星星在水面上從 0 走到 1 再回到 0，一圈是 cycleMs；收網只有一次，超過一圈就跑掉了。
 */

export interface StarTiming {
  cycleMs: number;
  /** 收網有效的位置區間（0 到 1，含兩端）。 */
  zone: { from: number; to: number };
}

/** 星星在這一圈裡的位置（0 到 1）。 */
export function starPhase(elapsedMs: number, cycleMs: number): number {
  const within = ((elapsedMs % cycleMs) + cycleMs) % cycleMs;
  return within / cycleMs;
}

/**
 * 按下收網的那一刻是否接到星星。elapsedMs 為 null 表示沒有按（沒接到）；
 * 超過一圈、負數或不是有限的數字也都沒接到。
 */
export function starCatchHit(elapsedMs: number | null, timing: StarTiming): boolean {
  if (elapsedMs === null || !Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs >= timing.cycleMs) return false;
  const phase = starPhase(elapsedMs, timing.cycleMs);
  return phase >= timing.zone.from && phase <= timing.zone.to;
}
