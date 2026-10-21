export interface ArcPoint {
  x: number;
  y: number;
  /** 相對於起點的大小（起點為 1）。 */
  scale: number;
}

/** 飛到終點時縮小的比例（剩下 1 - SHRINK）。 */
const SHRINK = 0.45;

/**
 * 拾取的飛行軌跡（純函式）：從起點直線飛向終點，中途拱起 lift 像素，同時縮小。
 * t 為進度（0 到 1）；起點與終點的位置完全吻合，不會跳動。
 */
export function pickupPoint(from: { x: number; y: number }, to: { x: number; y: number }, t: number, lift: number): ArcPoint {
  if (!(t >= 0 && t <= 1)) throw new RangeError(`進度必須在 0 到 1 之間：${t}`);
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t - 4 * lift * t * (1 - t),
    scale: 1 - SHRINK * t,
  };
}
