/**
 * 手機實機量測用的幀時間統計（見 docs/DEVICE_PERF.md）。純函式，不依賴 DOM 與 Phaser，可以單元測試。
 */

/** 超過這個間隔的一幀視為分頁切到背景或系統暫停，不算進統計。 */
export const MAX_FRAME_GAP_MS = 1000;

/** 60 Hz 每幀約 16.7 毫秒；超過約兩幀的時間就算掉幀。 */
export const SLOW_FRAME_MS = 33.4;

/** 網址上要帶 `?perf=1` 才會顯示量測覆蓋層；其他值（包括沒有）一律不顯示。 */
export function parsePerfFlag(search: string): boolean {
  return new URLSearchParams(search).get('perf') === '1';
}

export interface FrameStats {
  /** 納入統計的幀數（已排除背景間隔）。 */
  frames: number;
  /** 以平均幀時間換算的每秒幀數。 */
  fps: number;
  /** 幀時間的中位數與第 95 百分位（毫秒）。第 95 百分位反映「偶爾卡頓」的程度。 */
  p50: number;
  p95: number;
  /** 最慢的一幀（毫秒）。 */
  worst: number;
  /** 超過 SLOW_FRAME_MS 的幀數。 */
  slowFrames: number;
}

/** A frame interval positioned on the cumulative active-time clock. */
export interface TimedFrameSample {
  elapsedMs: number;
  deltaMs: number;
}

/** 幀時間（毫秒）列表 → 統計；沒有可用的幀時回傳 null。 */
export function summarizeFrames(deltas: readonly number[]): FrameStats | null {
  const kept = deltas.filter((d) => d > 0 && d < MAX_FRAME_GAP_MS).sort((a, b) => a - b);
  if (kept.length === 0) return null;
  const total = kept.reduce((sum, d) => sum + d, 0);
  return {
    frames: kept.length,
    fps: (1000 * kept.length) / total,
    p50: percentile(kept, 0.5),
    p95: percentile(kept, 0.95),
    worst: kept[kept.length - 1] ?? 0,
    slowFrames: kept.filter((d) => d > SLOW_FRAME_MS).length,
  };
}

/** Summarize a complete trailing interval; a background gap must not advance its active-time clock. */
export function summarizeFrameWindow(
  samples: readonly TimedFrameSample[],
  elapsedMs: number,
  windowMs: number,
): FrameStats | null {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(windowMs) || windowMs <= 0 || elapsedMs < windowMs) return null;
  const cutoff = elapsedMs - windowMs;
  return summarizeFrames(
    samples.filter((sample) => sample.elapsedMs > cutoff && sample.elapsedMs <= elapsedMs).map((sample) => sample.deltaMs),
  );
}

/** 已排序陣列的百分位（最近秩法）。 */
function percentile(sorted: readonly number[], q: number): number {
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1));
  return sorted[index] ?? 0;
}
