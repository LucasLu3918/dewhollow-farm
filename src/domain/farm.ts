import { fail, ok, type Result } from './result';

export interface CropState {
  cropId: string;
  growthDays: number;
}

/** 已開墾的田地狀態。未開墾的格子不會出現在 PlotMap 中。 */
export interface PlotState {
  watered: boolean;
  crop: CropState | null;
  /** 連續幾晚有作物卻沒有澆水；第 1 晚扣成長天數，第 2 晚枯死。 */
  dryDays: number;
}

export interface GrowthReport {
  plots: PlotMap;
  /** 這一晚枯死的作物 id（可能重複，依田地數量）。 */
  withered: string[];
}

/** 以 `plotKey(x, y)` 為鍵的田地表。 */
export type PlotMap = Record<string, PlotState>;

export type FarmFailure =
  | 'ALREADY_TILLED'
  | 'NO_SOIL'
  | 'ALREADY_PLANTED'
  | 'NO_CROP'
  | 'NOT_RIPE';

export function plotKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function tillPlot(plots: PlotMap, key: string): Result<PlotMap, FarmFailure> {
  if (plots[key]) return fail('ALREADY_TILLED');
  return ok({ ...plots, [key]: { watered: false, crop: null, dryDays: 0 } });
}

export function waterPlot(plots: PlotMap, key: string): Result<PlotMap, FarmFailure> {
  const plot = plots[key];
  if (!plot) return fail('NO_SOIL');
  return ok({ ...plots, [key]: { ...plot, watered: true } });
}

export function plantCrop(plots: PlotMap, key: string, cropId: string): Result<PlotMap, FarmFailure> {
  const plot = plots[key];
  if (!plot) return fail('NO_SOIL');
  if (plot.crop) return fail('ALREADY_PLANTED');
  return ok({ ...plots, [key]: { ...plot, dryDays: 0, crop: { cropId, growthDays: 0 } } });
}

export function isRipe(crop: CropState, maturityDays: number): boolean {
  return crop.growthDays >= maturityDays;
}

export function harvestPlot(
  plots: PlotMap,
  key: string,
  maturityDays: number,
): Result<{ plots: PlotMap; cropId: string }, FarmFailure> {
  const plot = plots[key];
  if (!plot) return fail('NO_SOIL');
  if (!plot.crop) return fail('NO_CROP');
  if (!isRipe(plot.crop, maturityDays)) return fail('NOT_RIPE');
  const cropId = plot.crop.cropId;
  return ok({ plots: { ...plots, [key]: { ...plot, crop: null } }, cropId });
}

/**
 * 睡覺結算：
 * - 已澆水的作物生長一天（不超過成熟天數），並重置缺水計數。
 * - 未澆水的作物：第 1 晚成長天數減 1（最低為 0），第 2 晚枯死。
 * - 沒有作物的田地只清除澆水標記。
 * 土地本身不會乾枯。
 */
export function growCrops(plots: PlotMap, maturityDaysFor: (cropId: string) => number): GrowthReport {
  const next: PlotMap = {};
  const withered: string[] = [];
  for (const [key, plot] of Object.entries(plots)) {
    const crop = plot.crop;
    if (!crop) {
      next[key] = { watered: false, crop: null, dryDays: 0 };
    } else if (plot.watered) {
      const cap = maturityDaysFor(crop.cropId);
      next[key] = {
        watered: false,
        crop: { ...crop, growthDays: Math.min(crop.growthDays + 1, cap) },
        dryDays: 0,
      };
    } else if (plot.dryDays + 1 >= 2) {
      withered.push(crop.cropId);
      next[key] = { watered: false, crop: null, dryDays: 0 };
    } else {
      next[key] = {
        watered: false,
        crop: { ...crop, growthDays: Math.max(crop.growthDays - 1, 0) },
        dryDays: plot.dryDays + 1,
      };
    }
  }
  return { plots: next, withered };
}
