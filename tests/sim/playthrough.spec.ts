import { describe, expect, it } from 'vitest';
import { simulate, type SimResult } from './playthrough';
import { SECONDS_PER_ACTION, SECONDS_PER_STEP } from './bot';
import { print, REPORT } from './env';

/**
 * 遊玩時數模擬（TECH_PLAN）：固定策略的無頭玩家玩 80 天。
 * 平常只跑短的（確認不會出錯、不會卡住）；`npm run sim` 設定 SIM_REPORT=1 時跑完整的一年並印出報告。
 */
const DAYS = REPORT ? 80 : 6;

describe('playthrough simulation', () => {
  it('plays without errors, keeps money and energy in range, and never gets stuck', () => {
    const result: SimResult = simulate(DAYS);
    expect(result.stuckAt).toBeNull();
    expect(result.days).toHaveLength(DAYS);
    const { finalState } = result;
    expect(finalState.gold).toBeGreaterThanOrEqual(0);
    expect(finalState.energy.current).toBeGreaterThanOrEqual(0);
    expect(finalState.energy.current).toBeLessThanOrEqual(finalState.energy.max);
    expect(SECONDS_PER_ACTION).toBeGreaterThan(SECONDS_PER_STEP);
  }, 120_000);

  it.runIf(REPORT)('prints the report for a full year', () => {
    const result = simulate(DAYS);
    const lines: string[] = [];
    lines.push('| 日 | 季 | 金幣 | 動作 | 步數 | 花費 | 出貨 | 礦坑 | 農 | 採 | 釣 | 礦 | 廚 | 工具(鋤/壺/斧/鎬) | 雞 | 牛 | 羊 | 估計分鐘 |');
    lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |');
    for (const d of result.days) {
      if (d.day % 5 !== 0 && d.day !== 1) continue;
      const t = d.tiers;
      lines.push(
        `| ${d.day} | ${d.season} | ${d.gold} | ${d.actions} | ${d.steps} | ${d.spent} | ${d.shipped} | ${d.deepest} | ${d.levels.farming} | ${d.levels.foraging} | ${d.levels.fishing} | ${d.levels.mining} | ${d.levels.cooking} | ${t.hoe}/${t.can}/${t.axe}/${t.pick} | ${d.animals} | ${d.cows} | ${d.sheep} | ${d.minutes.toFixed(1)} |`,
      );
    }
    lines.push('');
    lines.push('| 里程碑 | 第幾天 | 估計分鐘 |');
    lines.push('| --- | ---: | ---: |');
    for (const m of result.milestones) lines.push(`| ${m.label} | ${m.day} | ${m.minutes} |`);
    const summer = result.days.find((d) => d.day === 40);
    lines.push('');
    lines.push(`春＋夏結束（第 40 天）估計累計 ${summer?.minutes.toFixed(1) ?? '—'} 分鐘；目標約 120 分（GAME_DESIGN 時數預算）。`);
    print(`\n${lines.join('\n')}\n`);
  }, 600_000);
});
