import type { MapDef } from '../domain/content';
import { tileAt } from '../domain/world';
import { worldV2CandidateFramesFromManifest } from './world-v2-scene-candidate';

export const INDOOR_SCENE_CANDIDATE_QUERY = 'gate1IndoorScene';
export const INDOOR_SCENE_CANDIDATE_VALUE = 'p6-062';
export const INDOOR_SCENE_CANDIDATE_REGISTRY_KEY = 'gate1-p6-062-indoor-scene-candidate';
export const INDOOR_FARM_MANIFEST_KEY = 'gate1-p6-062-farm-interiors-manifest';
export const INDOOR_FARM_ATLAS_KEY = 'gate1-p6-062-farm-interiors-atlas';
export const INDOOR_MINE_MANIFEST_KEY = 'gate1-p6-062-mine-manifest';
export const INDOOR_MINE_ATLAS_KEY = 'gate1-p6-062-mine-atlas';

export const INDOOR_FARM_REQUIRED_FRAMES = [
  'coop-floor-a', 'coop-floor-b', 'coop-wall', 'coop-trough', 'coop-stall',
  'pasture-grass', 'pasture-grass-variant', 'pasture-fence-horizontal', 'pasture-fence-vertical',
  'pasture-fence-corner', 'pasture-path', 'pasture-water-edge', 'pasture-wall',
  'greenhouse-back', 'greenhouse-front', 'greenhouse-ground', 'greenhouse-glass', 'greenhouse-door',
] as const;

export const INDOOR_MINE_REQUIRED_FRAMES = [
  'cave-floor', 'cave-floor-variant', 'rock-wall', 'loose-rock', 'ore-copper', 'ore-silver',
  'ore-gold', 'stairs-up', 'stairs-down', 'cave-mouth', 'mine-exit-door', 'mine-support',
  'mine-lantern', 'mine-elevator',
] as const;

const greenhouseBounds = { left: 27, right: 33, top: 20, bottom: 25 };

export function indoorSceneCandidateRequested(
  search: URLSearchParams,
  isDev: boolean,
  renderProfile: string,
  pixel32RuntimeEnabled: boolean,
): boolean {
  return isDev
    && renderProfile === 'pixel32'
    && pixel32RuntimeEnabled
    && search.get(INDOOR_SCENE_CANDIDATE_QUERY) === INDOOR_SCENE_CANDIDATE_VALUE;
}

export function indoorSceneCandidateFramesFromManifest(
  value: unknown,
  expectedAtlas: string,
  requiredFrames: readonly string[],
) {
  return worldV2CandidateFramesFromManifest(value, expectedAtlas, requiredFrames);
}

/** Resolve a candidate tile presentation without changing authoritative map or world state. */
export function indoorSceneCandidateFrameFor(
  map: MapDef,
  x: number,
  y: number,
  layer: 'ground' | 'object',
  greenhouseUnlocked = false,
): { atlas: 'farm' | 'mine'; frame: string } | null {
  const tile = tileAt(map, x, y);
  if (!tile) return null;

  if (map.id.startsWith('mine-')) {
    if (layer === 'ground') {
      if (tile.kind === 'cave' && tile.to === 'mine-1') return { atlas: 'mine', frame: 'cave-mouth' };
      if (tile.kind === 'path' || tile.kind === 'cave') {
        return { atlas: 'mine', frame: (x * 7 + y * 11) % 13 === 0 ? 'cave-floor-variant' : 'cave-floor' };
      }
      return null;
    }
    if (tile.kind === 'wall') return { atlas: 'mine', frame: 'rock-wall' };
    if (tile.kind === 'rock') return { atlas: 'mine', frame: 'loose-rock' };
    if (tile.kind === 'ore') {
      const oreFrame = tile.item === 'copper-ore' ? 'ore-copper'
        : tile.item === 'silver-ore' ? 'ore-silver'
          : tile.item === 'gold-ore' ? 'ore-gold' : null;
      return oreFrame ? { atlas: 'mine', frame: oreFrame } : null;
    }
    if (tile.kind === 'stairs') {
      const currentLayer = /^mine-(\d+)$/.exec(map.id)?.[1];
      const destinationLayer = /^mine-(\d+)$/.exec(tile.to ?? '')?.[1];
      const ascending = tile.to === 'mine-entrance'
        || (currentLayer !== undefined && destinationLayer !== undefined && Number(destinationLayer) < Number(currentLayer));
      return { atlas: 'mine', frame: ascending ? 'stairs-up' : 'stairs-down' };
    }
    if (tile.kind === 'door') return { atlas: 'mine', frame: 'mine-exit-door' };
    return null;
  }

  if (map.id === 'farm' && greenhouseUnlocked
    && x >= greenhouseBounds.left && x <= greenhouseBounds.right
    && y >= greenhouseBounds.top && y <= greenhouseBounds.bottom) {
    if (tile.greenhouse) return { atlas: 'farm', frame: 'greenhouse-ground' };
    if (tile.kind === 'door') return { atlas: 'farm', frame: 'greenhouse-door' };
    if (tile.kind === 'wall' || tile.kind === 'fence') {
      if (y === greenhouseBounds.top) return { atlas: 'farm', frame: 'greenhouse-back' };
      if (y === greenhouseBounds.bottom) return { atlas: 'farm', frame: 'greenhouse-front' };
      return { atlas: 'farm', frame: 'greenhouse-glass' };
    }
  }

  if (map.id === 'coop' || map.id === 'cowbarn') {
    if (layer === 'ground' && tile.kind === 'floor') {
      if (tile.slot) return { atlas: 'farm', frame: 'coop-stall' };
      return { atlas: 'farm', frame: (x + y) % 2 === 0 ? 'coop-floor-a' : 'coop-floor-b' };
    }
    if (layer === 'object' && tile.kind === 'wall') return { atlas: 'farm', frame: 'coop-wall' };
    if (layer === 'object' && tile.kind === 'trough') return { atlas: 'farm', frame: 'coop-trough' };
    return null;
  }

  if (map.id === 'pasture') {
    if (layer === 'ground' && tile.kind === 'grass') {
      return { atlas: 'farm', frame: (x * 5 + y * 3) % 9 === 0 ? 'pasture-grass-variant' : 'pasture-grass' };
    }
    if (layer === 'ground' && tile.kind === 'path') return { atlas: 'farm', frame: 'pasture-path' };
    if (layer === 'object' && tile.kind === 'fence') {
      const north = tileAt(map, x, y - 1)?.kind === 'fence';
      const east = tileAt(map, x + 1, y)?.kind === 'fence';
      const south = tileAt(map, x, y + 1)?.kind === 'fence';
      const west = tileAt(map, x - 1, y)?.kind === 'fence';
      if ((north || south) && (east || west)) return { atlas: 'farm', frame: 'pasture-fence-corner' };
      return { atlas: 'farm', frame: east || west ? 'pasture-fence-horizontal' : 'pasture-fence-vertical' };
    }
    if (layer === 'object' && tile.kind === 'wall') {
      const waterEdge = tileAt(map, x, y - 1)?.kind === 'grass' || tileAt(map, x + 1, y)?.kind === 'grass'
        || tileAt(map, x, y + 1)?.kind === 'grass' || tileAt(map, x - 1, y)?.kind === 'grass';
      return { atlas: 'farm', frame: waterEdge ? 'pasture-water-edge' : 'pasture-wall' };
    }
    if (layer === 'object' && tile.kind === 'tuft') return { atlas: 'farm', frame: 'pasture-grass-variant' };
  }

  return null;
}
