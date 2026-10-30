import type { CropDef, CropVisualGrowthStage, GroundKind, MapDef, TileKind } from '../domain/content';
import type { PlotMap } from '../domain/farm';
import { tileAt } from '../domain/world';
import { groundLayerFor, isGroundLayer } from './map-layers';

export interface MapRenderTile {
  x: number;
  y: number;
  /** Original legacy kind remains available for map-change and art selection. */
  base: TileKind;
  ground: GroundKind;
  /** Opaque ground tiles have no separate object image. */
  object: TileKind | null;
}

export interface MapRenderPlan {
  mapId: string;
  width: number;
  height: number;
  /** Stable row-major presentation plan derived from the legacy rows/legend map. */
  tiles: MapRenderTile[];
}

export type PlotRenderStage = CropVisualGrowthStage;

export interface PlotRenderTile {
  x: number;
  y: number;
  watered: boolean;
  crop?: {
    cropId: string;
    stage: PlotRenderStage;
    /** Legacy visual fallback only; configured crop milestones use a fixed native sprite. */
    scale?: number;
    alpha?: number;
  };
}

/** Convert the existing content map into render layers without changing its collision or portal data. */
export function legacyMapRenderPlan(map: MapDef): MapRenderPlan {
  const tiles: MapRenderTile[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = tileAt(map, x, y);
      if (!tile) continue;
      tiles.push({
        x,
        y,
        base: tile.kind,
        ground: groundLayerFor(map, x, y),
        object: isGroundLayer(tile.kind) ? null : tile.kind,
      });
    }
  }
  return { mapId: map.id, width: map.width, height: map.height, tiles };
}

/** Convert the already merged held/current plot snapshot into render-only crop presentation values. */
export function plotRenderPlan(
  plots: PlotMap,
  map: Pick<MapDef, 'id' | 'width' | 'height'>,
  cropForCropId: (cropId: string) => Pick<CropDef, 'id' | 'growthDays' | 'visualGrowthStages'>,
): PlotRenderTile[] {
  const result: PlotRenderTile[] = [];
  for (const [key, plot] of Object.entries(plots)) {
    const prefix = `${map.id}|`;
    if (!key.startsWith(prefix)) continue;
    const [x, y] = key.slice(prefix.length).split(',').map(Number);
    if (x === undefined || y === undefined) continue;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;

    const tile: PlotRenderTile = { x, y, watered: plot.watered };
    if (plot.crop) {
      const crop = cropForCropId(plot.crop.cropId);
      const milestones = crop.visualGrowthStages;
      if (milestones?.length) {
        const growthDay = Math.min(crop.growthDays, Math.max(0, plot.crop.growthDays));
        let milestone = milestones[0]!;
        for (const candidate of milestones) {
          if (candidate.day > growthDay) break;
          milestone = candidate;
        }
        tile.crop = { cropId: plot.crop.cropId, stage: milestone.stage };
      } else {
        const ratio = Math.min(1, plot.crop.growthDays / crop.growthDays);
        const stage: PlotRenderStage = ratio < 0.25 ? 'seed' : ratio < 0.7 ? 'sprout' : 'mature';
        tile.crop = {
          cropId: plot.crop.cropId,
          stage,
          scale: 0.5 + 0.5 * ratio,
          alpha: 0.5 + 0.5 * ratio,
        };
      }
    }
    result.push(tile);
  }
  return result;
}
