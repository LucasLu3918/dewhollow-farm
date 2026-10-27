import type { MapDef, TileKind } from '../domain/content';
import { tileAt } from '../domain/world';
import { explicitlyUnapprovedCandidateFramesFromManifest, type CandidateFrameRect } from './pixel32-candidate-runtime';
import { groundLayerFor, isGroundLayer } from './map-layers';

export const WORLD_V2_SCENE_CANDIDATE_QUERY = 'gate1SceneVisual';
export const WORLD_V2_SCENE_CANDIDATE_VALUE = 'world-v2-cozy';
export const WORLD_V2_FARM_MANIFEST_KEY = 'gate1-world-v2-farm-manifest';
export const WORLD_V2_FARM_ATLAS_KEY = 'gate1-world-v2-farm-atlas';
export const WORLD_V2_HOUSE_MANIFEST_KEY = 'gate1-world-v2-house-manifest';
export const WORLD_V2_HOUSE_ATLAS_KEY = 'gate1-world-v2-house-atlas';

export const WORLD_V2_FARM_REQUIRED_FRAMES = [
  'grass-base', 'grass-variant', 'path-center', 'path-edge', 'soil-dry', 'soil-wet',
  'house-exterior', 'house-front', 'tree-canopy', 'shipping-crate', 'stone-wall',
  'fence-horizontal', 'fence-vertical', 'fence-north-east', 'fence-north-west', 'fence-south-east', 'fence-south-west',
] as const;

export const WORLD_V2_HOUSE_REQUIRED_FRAMES = [
  'floor-a', 'floor-b', 'wall-middle', 'wall-left-corner', 'wall-right-corner',
  'wall-top', 'wall-bottom', 'wall-window', 'door-threshold', 'rug', 'bed',
  'kitchen-counter', 'stove', 'workbench', 'storage', 'wardrobe', 'table', 'chair',
  'entry-mat', 'shoe-storage', 'pet-bed', 'water-bowl', 'shelf-books', 'plant',
] as const;

const CANDIDATE_HOUSE_MAP_IDS = new Set(['house', 'house-wing', 'house-full']);

export function worldV2FarmSceneCandidatePlacements(): readonly {
  frame: string;
  anchorTile: { x: number; y: number };
  layer: 'back' | 'front';
}[] {
  return [
    { frame: 'house-exterior', anchorTile: { x: 2, y: 4 }, layer: 'back' },
    { frame: 'house-front', anchorTile: { x: 2, y: 4 }, layer: 'front' },
    { frame: 'tree-canopy', anchorTile: { x: 10, y: 8 }, layer: 'front' },
  ];
}

/** Validate the fixed 32px/2x candidate contract and require every requested frame to stay unapproved. */
export function worldV2CandidateFramesFromManifest(
  value: unknown,
  expectedAtlas: string,
  requiredFrames: readonly string[],
): Record<string, CandidateFrameRect> | null {
  if (!value || typeof value !== 'object') return null;
  const manifest = value as {
    status?: unknown;
    approved?: unknown;
    pixelContract?: { nativeTileSize?: unknown; displayScale?: unknown };
    atlas?: { file?: unknown; width?: unknown; height?: unknown };
    frames?: unknown;
  };
  if (manifest.status !== 'candidate' || manifest.approved !== false
    || manifest.pixelContract?.nativeTileSize !== 32
    || manifest.pixelContract.displayScale !== 2) return null;
  const atlas = manifest.atlas;
  if (!atlas || atlas.file !== expectedAtlas
    || !Number.isInteger(atlas.width) || (atlas.width as number) <= 0
    || !Number.isInteger(atlas.height) || (atlas.height as number) <= 0) return null;

  // Farm v2 stores frames as an id-keyed record; house v2 uses the same authored
  // contract in an id-bearing array. Normalize both to Phaser's frame rectangle.
  let frames: Record<string, CandidateFrameRect> | null = null;
  const rawFrames = manifest.frames;
  if (Array.isArray(rawFrames)) {
    const normalized: Record<string, CandidateFrameRect> = {};
    for (const candidate of rawFrames) {
      if (!candidate || typeof candidate !== 'object') return null;
      const frame = candidate as { id?: unknown; rect?: Partial<CandidateFrameRect>; approved?: unknown };
      const rect = frame.rect;
      if (typeof frame.id !== 'string' || !frame.id || frame.approved !== false || !rect
        || !Number.isInteger(rect.x) || !Number.isInteger(rect.y)
        || !Number.isInteger(rect.width) || !Number.isInteger(rect.height)
        || (rect.x as number) < 0 || (rect.y as number) < 0
        || (rect.width as number) <= 0 || (rect.height as number) <= 0
        || (rect.x as number) + (rect.width as number) > (atlas.width as number)
        || (rect.y as number) + (rect.height as number) > (atlas.height as number)
        || normalized[frame.id]) return null;
      normalized[frame.id] = { x: rect.x!, y: rect.y!, width: rect.width!, height: rect.height!, approved: false };
    }
    frames = Object.keys(normalized).length ? normalized : null;
  } else {
    frames = explicitlyUnapprovedCandidateFramesFromManifest(value, expectedAtlas);
  }
  if (!frames || requiredFrames.some((frame) => !frames[frame])) return null;
  return frames;
}

export function worldV2SceneCandidateRequested(
  search: URLSearchParams,
  isDev: boolean,
  renderProfile: string,
  pixel32RuntimeEnabled: boolean,
): boolean {
  return isDev
    && renderProfile === 'pixel32'
    && pixel32RuntimeEnabled
    && search.get(WORLD_V2_SCENE_CANDIDATE_QUERY) === WORLD_V2_SCENE_CANDIDATE_VALUE;
}

/** Return the candidate frame for one legacy map tile layer, or null to preserve the legacy renderer. */
export function worldV2SceneCandidateFrameFor(
  map: MapDef,
  x: number,
  y: number,
  layer: 'ground' | 'object',
): string | null {
  const tile = tileAt(map, x, y);
  if (!tile) return null;

  if (map.id === 'farm') {
    if (layer === 'object') return farmObjectFrame(map, x, y, tile.kind);
    const ground = isGroundLayer(tile.kind) ? tile.kind : groundLayerFor(map, x, y);
    if (ground === 'grass') return (x * 3 + y * 5 + 1) % 11 === 0 ? 'grass-variant' : 'grass-base';
    if (ground === 'field' || ground === 'path') return autotileFrame(map, x, y, ground);
    return null;
  }

  // The presentation-only adapter shares one authored 22x20 composition across
  // the three remodel variants; each variant retains its own rules and save data.
  if (map.id !== 'house' && (!CANDIDATE_HOUSE_MAP_IDS.has(map.id) || map.width !== 22 || map.height !== 20)) return null;
  if (layer === 'ground') {
    const ground = isGroundLayer(tile.kind) ? tile.kind : groundLayerFor(map, x, y);
    if (ground === 'floor') return (x + y) % 2 === 0 ? 'floor-a' : 'floor-b';
    return null;
  }

  return tile.kind === 'wall' ? houseObjectFrame(map, tile.kind, x, y) : null;
}

function autotileFrame(map: MapDef, x: number, y: number, kind: 'field' | 'path'): string {
  const mask = (tileAt(map, x, y - 1)?.kind === kind ? 1 : 0)
    | (tileAt(map, x + 1, y)?.kind === kind ? 2 : 0)
    | (tileAt(map, x, y + 1)?.kind === kind ? 4 : 0)
    | (tileAt(map, x - 1, y)?.kind === kind ? 8 : 0);
  return `${kind}-mask-${mask.toString(16).padStart(2, '0')}`;
}

function farmObjectFrame(map: MapDef, x: number, y: number, kind: TileKind): string | null {
  if (kind === 'shipbox') return 'shipping-crate';
  if (kind === 'wall') return 'stone-wall';
  if (kind === 'fence') {
    const connected = {
      north: tileAt(map, x, y - 1)?.kind === 'fence',
      east: tileAt(map, x + 1, y)?.kind === 'fence',
      south: tileAt(map, x, y + 1)?.kind === 'fence',
      west: tileAt(map, x - 1, y)?.kind === 'fence',
    };
    if (connected.north && connected.east && !connected.south && !connected.west) return 'fence-north-east';
    if (connected.north && connected.west && !connected.south && !connected.east) return 'fence-north-west';
    if (connected.south && connected.east && !connected.north && !connected.west) return 'fence-south-east';
    if (connected.south && connected.west && !connected.north && !connected.east) return 'fence-south-west';
    if (connected.east || connected.west) return 'fence-horizontal';
    return 'fence-vertical';
  }
  return null;
}

function houseObjectFrame(map: MapDef, kind: TileKind, x: number, y: number): string | null {
  if (kind === 'wall') {
    if (y === 0 && x === 0) return 'wall-left-corner';
    if (y === 0 && x === map.width - 1) return 'wall-right-corner';
    if (y === 0) return x === Math.floor(map.width / 2) ? 'wall-window' : 'wall-top';
    if (y === map.height - 1) return 'wall-bottom';
    if (x === 0 || x === map.width - 1) return 'wall-middle';
    return 'wall-middle';
  }

  return null;
}
