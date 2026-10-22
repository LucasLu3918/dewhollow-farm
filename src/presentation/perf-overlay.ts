import { MAX_FRAME_GAP_MS, summarizeFrameWindow, summarizeFrames, type TimedFrameSample } from './frame-stats';

/**
 * 量測覆蓋層（網址帶 `?perf=1` 才會出現）：用 requestAnimationFrame 的實際間隔量幀時間，
 * 讓手機上沒有開發者工具的人也能讀到數字。5 秒列供即時觀察，完整 30 秒列供可重現量測。
 * 只讀不寫，不影響遊戲狀態；與 Phaser 無關，量的是整個頁面的畫面節奏。
 */

/** 即時數字的滾動視窗。 */
const LIVE_WINDOW_MS = 5_000;
/** 一次可重現量測的完整滾動視窗。 */
const MEASUREMENT_WINDOW_MS = 30_000;
/** 文字更新的間隔（毫秒）。 */
const REFRESH_MS = 500;

export function startPerfOverlay(doc: Document, win: Window = window): void {
  const box = doc.createElement('div');
  box.className = 'perf-overlay';
  box.setAttribute('aria-hidden', 'true');
  doc.body.append(box);

  const samples: TimedFrameSample[] = [];
  let firstSample = 0;
  let elapsedActiveMs = 0;
  let last: number | null = null;
  const onFrame = (now: number): void => {
    if (last !== null) {
      const deltaMs = now - last;
      // Exclude long background pauses from both statistics and the 30-second active-time clock.
      if (deltaMs > 0 && deltaMs < MAX_FRAME_GAP_MS) {
        elapsedActiveMs += deltaMs;
        samples.push({ elapsedMs: elapsedActiveMs, deltaMs });
        while (firstSample < samples.length && samples[firstSample]!.elapsedMs <= elapsedActiveMs - MEASUREMENT_WINDOW_MS) {
          firstSample += 1;
        }
      }
      // Compact only occasionally so appending frames does not shift the array on every frame.
      if (firstSample > 256 && firstSample * 2 >= samples.length) {
        samples.splice(0, firstSample);
        firstSample = 0;
      }
    }
    last = now;
    win.requestAnimationFrame(onFrame);
  };
  win.requestAnimationFrame(onFrame);

  // 長任務（超過 50 毫秒的主執行緒工作）：iOS Safari 不支援這個紀錄，沒有就顯示「—」。
  const longTaskActiveTimes: number[] = [];
  let observesLongTasks = false;
  if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
    observesLongTasks = true;
    new PerformanceObserver((list) => {
      for (const _entry of list.getEntries()) longTaskActiveTimes.push(elapsedActiveMs);
    }).observe({ type: 'longtask', buffered: false });
  }

  const render = (): void => {
    const current = samples.slice(firstSample);
    const liveStats = summarizeFrames(
      current.filter((sample) => sample.elapsedMs > elapsedActiveMs - LIVE_WINDOW_MS).map((sample) => sample.deltaMs),
    );
    const measurementStats = summarizeFrameWindow(current, elapsedActiveMs, MEASUREMENT_WINDOW_MS);
    const completeWindow = elapsedActiveMs >= MEASUREMENT_WINDOW_MS;
    while (longTaskActiveTimes[0] !== undefined && longTaskActiveTimes[0] <= elapsedActiveMs - MEASUREMENT_WINDOW_MS) {
      longTaskActiveTimes.shift();
    }

    if (!liveStats) {
      box.textContent = '即時 5 秒視窗：量測中…\n完整 30 秒視窗：累積中…';
      return;
    }
    const formatStats = (label: string, stats: ReturnType<typeof summarizeFrames>): string => stats
      ? `${label} FPS ${stats.fps.toFixed(1)}｜p50 ${stats.p50.toFixed(1)} ms｜p95 ${stats.p95.toFixed(1)} ms｜掉幀 ${stats.slowFrames}/${stats.frames}｜最慢 ${stats.worst.toFixed(1)} ms`
      : `${label}：量測中…`;
    box.textContent = [
      formatStats('即時 5 秒視窗', liveStats),
      completeWindow
        ? `${formatStats('完整 30 秒視窗', measurementStats)}｜長任務 ${observesLongTasks ? longTaskActiveTimes.length : '—'}`
        : `完整 30 秒視窗：累積中（${Math.floor(elapsedActiveMs / 1_000)} / 30 秒）`,
    ].join('\n');
  };
  win.setInterval(render, REFRESH_MS);
}
