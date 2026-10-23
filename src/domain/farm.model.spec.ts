import { describe, expect, it } from 'vitest';
import { growCrops, harvestPlot, plantCrop, plotKey, tillPlot, waterAllPlots, waterPlot } from './farm';
import type { PlotMap } from './farm';

/**
 * 有限範圍的窮舉模型檢查（bounded exhaustive model check）。
 *
 * 對「一塊田」反覆套用 farm.ts 的真實函式（開墾、澆水、播種、收成、下雨、睡覺結算），
 * 從空地出發做廣度優先搜尋，走遍所有可達狀態，並在每一步檢查性質。
 * 轉移性質的預期值依據 growCrops 的註解（「睡覺結算」）逐條寫成，不是從實作抄來的。
 *
 * 範圍：一塊田、一種作物、成熟天數 3。不含肥料、多塊田的交互作用與存檔。
 * 狀態數有限：growthDays 被成熟天數封頂，dryDays 只會是 0 或 1。
 */

const KEY = plotKey(0, 0);
const CROP = 'moonbean';
const MATURITY = 3;
const maturityDaysFor = () => MATURITY;

const ACTIONS = ['till', 'water', 'plant', 'harvest', 'rain', 'night'] as const;
type Action = (typeof ACTIONS)[number];

interface Step {
  plots: PlotMap;
  withered: string[];
  harvested: boolean;
}

function apply(plots: PlotMap, action: Action): Step {
  switch (action) {
    case 'till': {
      const r = tillPlot(plots, KEY);
      return { plots: r.ok ? r.value : plots, withered: [], harvested: false };
    }
    case 'water': {
      const r = waterPlot(plots, KEY);
      return { plots: r.ok ? r.value : plots, withered: [], harvested: false };
    }
    case 'plant': {
      const r = plantCrop(plots, KEY, CROP);
      return { plots: r.ok ? r.value : plots, withered: [], harvested: false };
    }
    case 'harvest': {
      const r = harvestPlot(plots, KEY, MATURITY);
      return { plots: r.ok ? r.value.plots : plots, withered: [], harvested: r.ok };
    }
    case 'rain':
      return { plots: waterAllPlots(plots), withered: [], harvested: false };
    case 'night': {
      const report = growCrops(plots, maturityDaysFor);
      return { plots: report.plots, withered: report.withered, harvested: false };
    }
  }
}

/** 任何狀態都必須成立的性質。 */
function stateProblems(plots: PlotMap): string[] {
  const plot = plots[KEY];
  if (!plot) return [];
  const problems: string[] = [];
  if (plot.dryDays !== 0 && plot.dryDays !== 1) problems.push(`缺水天數超出範圍：${plot.dryDays}`);
  if (!plot.crop && plot.dryDays !== 0) problems.push('沒有作物的田卻有缺水天數');
  if (plot.crop && (plot.crop.growthDays < 0 || plot.crop.growthDays > MATURITY)) {
    problems.push(`成長天數超出 0..${MATURITY}：${plot.crop.growthDays}`);
  }
  return problems;
}

/** 睡覺結算的轉移性質，預期值依據 growCrops 的註解：澆水生長、第 1 晚缺水減一天、第 2 晚枯死。 */
function nightProblems(before: PlotMap, step: Step): string[] {
  const old = before[KEY];
  const now = step.plots[KEY];
  if (!old) return [];
  const problems: string[] = [];
  if (now?.watered) problems.push('睡覺後澆水標記沒有清除');
  if (!old.crop) {
    if (now?.crop) problems.push('沒有作物的田在睡覺後長出作物');
    return problems;
  }
  const g = old.crop.growthDays;
  if (old.watered) {
    if (now?.crop?.growthDays !== Math.min(g + 1, MATURITY)) problems.push('澆水的作物沒有生長一天（或超過成熟天數）');
    if (now?.dryDays !== 0) problems.push('澆水的作物沒有重置缺水天數');
  } else if (old.dryDays === 0) {
    if (now?.crop?.growthDays !== Math.max(g - 1, 0)) problems.push('第 1 晚缺水，成長天數沒有減一（最低為 0）');
    if (now?.dryDays !== 1) problems.push('第 1 晚缺水，缺水天數沒有變成 1');
  } else {
    if (now?.crop !== null) problems.push('連續第 2 晚缺水，作物沒有枯死');
    if (step.withered.join() !== CROP) problems.push(`枯死清單不正確：${step.withered.join() || '（空）'}`);
  }
  return problems;
}

function describeTrace(trace: Action[]): string {
  return trace.length === 0 ? '（初始狀態）' : trace.join(' → ');
}

interface Explored {
  states: number;
  witheredReached: boolean;
  counterexample: { trace: Action[]; problems: string[] } | null;
}

/** 廣度優先搜尋：第一個違反性質的路徑一定是最短的，所以反例最容易讀。 */
function explore(): Explored {
  const start: PlotMap = {};
  const seen = new Set([JSON.stringify(start)]);
  const queue: { plots: PlotMap; trace: Action[] }[] = [{ plots: start, trace: [] }];
  let witheredReached = false;

  for (const node of queue) {
    for (const action of ACTIONS) {
      const step = apply(node.plots, action);
      const problems = [...stateProblems(step.plots)];
      if (action === 'night') problems.push(...nightProblems(node.plots, step));
      if (action === 'harvest' && step.harvested) {
        const crop = node.plots[KEY]?.crop;
        if (!crop || crop.growthDays < MATURITY) problems.push('未成熟的作物被收成');
      }
      if (step.withered.length > 0) witheredReached = true;

      const trace = [...node.trace, action];
      if (problems.length > 0) {
        return { states: seen.size, witheredReached, counterexample: { trace, problems } };
      }
      const key = JSON.stringify(step.plots);
      if (!seen.has(key)) {
        seen.add(key);
        queue.push({ plots: step.plots, trace });
      }
    }
  }
  return { states: seen.size, witheredReached, counterexample: null };
}

describe('farm plot model: bounded exhaustive check of farm.ts', () => {
  const result = explore();

  it('finds no property violation in any reachable state', () => {
    const ce = result.counterexample;
    expect(ce, ce ? `反例：${describeTrace(ce.trace)}：${ce.problems.join('；')}` : '').toBeNull();
  });

  it('explores a non-trivial space that includes a withered crop', () => {
    expect(result.states).toBeGreaterThan(10);
    expect(result.witheredReached).toBe(true);
  });
});
