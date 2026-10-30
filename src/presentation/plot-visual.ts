import type { Season } from '../domain/calendar';
import { plotMapKey, type PlotMap, type PlotState } from '../domain/farm';

export type PlotVisualPhase =
  | 'tilled-dry'
  | 'tilled-wet'
  | 'seeded-dry'
  | 'seeded-wet'
  | 'sprout'
  | 'vegetative'
  | 'flowering'
  | 'mature'
  | 'withered';

export interface CropVisualMilestone {
  day: number;
  phase: PlotVisualPhase;
  frame: string;
}

export interface CropVisualDefinition {
  seedFrame: string;
  milestones: readonly CropVisualMilestone[];
}

export interface PlotVisual {
  phase: PlotVisualPhase;
  soilFrame: string;
  plantFrame?: string;
  anchor: { x: number; y: number };
  depthLayer: number;
  highlight?: 'harvestable';
}

const SOIL_ANCHOR = { x: 32, y: 62 } as const;

/** Return the north/east/south/west adjacency mask for currently tilled plots. */
export function plotNeighborMask(x: number, y: number, plots: PlotMap, watered: boolean, mapId = 'farm'): number {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return 0;
  let mask = 0;
  if (plots[plotMapKey(mapId, x, y - 1)]?.watered === watered) mask |= 1;
  if (plots[plotMapKey(mapId, x + 1, y)]?.watered === watered) mask |= 2;
  if (plots[plotMapKey(mapId, x, y + 1)]?.watered === watered) mask |= 4;
  if (plots[plotMapKey(mapId, x - 1, y)]?.watered === watered) mask |= 8;
  return mask;
}

/** Resolve only visual values; growth milestones are supplied by crop content and state is never changed. */
export function resolvePlotVisual(
  plot: Pick<PlotState, 'watered' | 'crop'>,
  crop: CropVisualDefinition | null,
  neighborMask: number,
  season: Season,
): PlotVisual {
  const mask = Number.isInteger(neighborMask) ? Math.max(0, Math.min(15, neighborMask)) : 0;
  const moisture = plot.watered ? 'wet' : 'dry';
  const visual: PlotVisual = {
    phase: plot.crop ? (plot.watered ? 'seeded-wet' : 'seeded-dry') : (plot.watered ? 'tilled-wet' : 'tilled-dry'),
    soilFrame: `${season}-${moisture}-soil-edge-${mask.toString(16)}`,
    anchor: { ...SOIL_ANCHOR },
    depthLayer: 1,
  };

  if (!plot.crop) return visual;
  visual.plantFrame = crop?.seedFrame;
  if (!crop?.milestones.length) return visual;

  const milestone = [...crop.milestones]
    .filter((candidate) => Number.isFinite(candidate.day) && candidate.day <= plot.crop!.growthDays)
    .sort((left, right) => left.day - right.day)
    .at(-1);
  if (milestone) {
    visual.phase = milestone.phase;
    visual.plantFrame = milestone.frame;
    if (milestone.phase === 'mature') visual.highlight = 'harvestable';
  }
  return visual;
}
