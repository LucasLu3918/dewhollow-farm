import type { ActionKind } from './tuning';

/** 所有工具。 */
export const TOOL_IDS = ['hoe', 'can', 'seedbag', 'axe', 'pick', 'rod'] as const;
export type ToolId = (typeof TOOL_IDS)[number];

/** 按 Z 循環的工具（三件農具）。斧頭用 A 鍵直接取出，不進循環，既有的按鍵次數不變。 */
export const TOOL_ORDER: readonly ToolId[] = ['hoe', 'can', 'seedbag'];

export const TOOL_NAMES: Record<ToolId, string> = {
  hoe: '鋤頭',
  can: '水壺',
  seedbag: '種子袋',
  axe: '斧頭',
  pick: '鎬',
  rod: '釣竿',
};

/** 階級名稱：0 基礎、1 銅、2 銀、3 金。 */
export const TIER_NAMES = ['基礎', '銅', '銀', '金'] as const;

const ACTION_TOOL: Partial<Record<ActionKind, ToolId>> = {
  till: 'hoe',
  water: 'can',
  plant: 'seedbag',
  chop: 'axe',
  mine: 'pick',
  fish: 'rod',
};

/** 哪個動作由哪個工具負責；沒有工具的動作回傳 null。 */
export function toolForAction(action: ActionKind): ToolId | null {
  return ACTION_TOOL[action] ?? null;
}

export interface ToolTier {
  energyDiscount: number;
}

/**
 * 工具階級的體力折扣：階級越高，動作越省體力。
 * 基礎消耗為 0 的動作（出貨）維持 0；其餘最少為 1。
 */
export function energyCostFor(base: number, tier: number, tiers: readonly ToolTier[]): number {
  const level = tiers[tier];
  if (!level) throw new RangeError(`沒有這個工具階級：${tier}`);
  if (base === 0) return 0;
  return Math.max(1, base - level.energyDiscount);
}
