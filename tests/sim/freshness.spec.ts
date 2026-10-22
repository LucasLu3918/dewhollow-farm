import { describe, expect, it } from 'vitest';
import { simulate } from './playthrough';
import { print, REPORT } from './env';

/**
 * 新鮮度（docs/PLAYTIME_PLAN.md 第 5、6 節）：第 1–40 天（春夏），任何連續 5 天內至少有一個新里程碑。
 * 里程碑是模擬中第一次發生的事：成就、圖鑑門檻、委託、主線章節、節慶與節慶日、心形事件、修復、信件、
 * 隨機事件、季節更替。若失敗，訊息列出空窗期的起訖天數與當時的里程碑，方便補內容（不得靠降低體力達成）。
 */
const DAYS = 40;
const WINDOW = 5;

describe('freshness: a new milestone at least every five days, days 1–40', () => {
  it('no window of five consecutive days goes without a new milestone', () => {
    const result = simulate(DAYS);
    expect(result.stuckAt).toBeNull();
    expect(result.days.length).toBe(DAYS);

    const milestoneDays = result.milestones.map((m) => m.day);
    const gaps: string[] = [];
    for (let start = 1; start + WINDOW - 1 <= DAYS; start += 1) {
      const end = start + WINDOW - 1;
      if (!milestoneDays.some((d) => d >= start && d <= end)) gaps.push(`第 ${start}–${end} 天`);
    }
    if (REPORT || gaps.length > 0) {
      const lines = result.milestones.map((m) => `第 ${m.day} 天：${m.label}`);
      print(`\n里程碑（共 ${lines.length} 個）：\n${lines.join('\n')}\n空窗期：${gaps.length > 0 ? gaps.join('、') : '無'}\n`);
    }
    expect(gaps).toEqual([]);
  }, 600_000);
});
