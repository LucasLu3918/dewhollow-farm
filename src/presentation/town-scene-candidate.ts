import type { MapDef, Point, TileDef, TileKind } from '../domain/content';
import { tileAt } from '../domain/world';

export const TOWN_SCENE_CANDIDATE_QUERY = 'gate1TownVisual';
export const TOWN_SCENE_CANDIDATE_VALUE = 'p6-060';
export const TOWN_SCENE_CANDIDATE_ATLAS_FILE = 'atlas.png';
export const TOWN_SCENE_CANDIDATE_ATLAS_KEY = 'p6-060-town-atlas';
export const TOWN_SCENE_CANDIDATE_MANIFEST_KEY = 'p6-060-town-manifest';
export const TOWN_SCENE_CANDIDATE_REGISTRY_KEY = 'p6-060-town-enabled';

export const TOWN_SCENE_CANDIDATE_REQUIRED_FRAMES = [
  'general-store',
  'blacksmith',
  'night-market-stall',
  'traveling-merchant-cart',
  'bulletin-board',
  'anvil',
  'lantern',
  'vegetable-crate',
  'flower-planter',
  'bench',
  'festival-pennants',
  'well',
  'market-display-table',
  'coal-brazier',
  'blank-signpost',
  'barrel-and-sack',
] as const;

export const TOWN_SCENE_CANDIDATE_TILE_FRAMES = [
  'grass-base', 'grass-dapple-a', 'grass-dapple-b', 'grass-flower',
  'path-stone', 'path-stone-alt', 'plaza-cobble', 'plaza-cobble-alt', 'wall-stone',
] as const;

export type TownSceneCandidateFrame = (typeof TOWN_SCENE_CANDIDATE_REQUIRED_FRAMES)[number];

export interface TownSceneCandidatePlacement {
  frame: TownSceneCandidateFrame;
  anchorTile: Point;
  /** All current town candidate objects are depth sorted above the map and actors. */
  layer: 'front';
}

interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PLAZA_DECOR: readonly {
  frame: TownSceneCandidateFrame;
  anchorTile: Point;
  accepts: (tile: TileDef | null | undefined) => boolean;
}[] = [
  { frame: 'night-market-stall', anchorTile: { x: 13, y: 10 }, accepts: (tile) => tile?.kind === 'shop' && tile.shop === 'night-market' },
  { frame: 'traveling-merchant-cart', anchorTile: { x: 14, y: 8 }, accepts: (tile) => tile?.kind === 'shop' && tile.shop === 'traveling-merchant' },
  { frame: 'bulletin-board', anchorTile: { x: 3, y: 10 }, accepts: (tile) => tile?.kind === 'furniture' && tile.notice === 'bulletin' },
  { frame: 'festival-pennants', anchorTile: { x: 1, y: 8 }, accepts: (tile) => tile?.kind === 'furniture' && tile.notice === 'festival' },
  { frame: 'anvil', anchorTile: { x: 6, y: 10 }, accepts: (tile) => tile?.kind === 'furniture' && tile.notice === 'repair' },
  ...[
    { x: 2, y: 1 }, { x: 13, y: 1 }, { x: 4, y: 4 }, { x: 11, y: 4 },
  ].map((anchorTile) => ({ frame: 'lantern' as const, anchorTile, accepts: (tile: TileDef | null | undefined) => tile?.kind === 'furniture' && tile.festival === 'lantern' })),
  { frame: 'well', anchorTile: { x: 8, y: 2 }, accepts: (tile) => tile?.kind === 'water' },
  { frame: 'bench', anchorTile: { x: 4, y: 10 }, accepts: (tile) => tile?.kind === 'furniture' },
  { frame: 'market-display-table', anchorTile: { x: 5, y: 10 }, accepts: (tile) => tile?.kind === 'furniture' },
  { frame: 'barrel-and-sack', anchorTile: { x: 10, y: 10 }, accepts: (tile) => tile?.kind === 'grass' },
];

/** The third exact DEV opt-in keeps this unapproved town art isolated from other previews. */
export function townSceneCandidateRequested(
  search: URLSearchParams,
  isDev: boolean,
  pixel32RuntimeEnabled: boolean,
): boolean {
  const values = search.getAll(TOWN_SCENE_CANDIDATE_QUERY);
  return isDev && pixel32RuntimeEnabled
    && values.length === 1
    && values[0] === TOWN_SCENE_CANDIDATE_VALUE;
}

/** Validate the checked-in 4×4, 64px-per-frame, explicitly unapproved P6-060 atlas contract. */
export function townSceneCandidateFramesFromManifest(value: unknown): Record<string, FrameRect> | null {
  if (!value || typeof value !== 'object') return null;
  const manifest = value as {
    candidateId?: unknown;
    status?: unknown;
    approved?: unknown;
    runtimeAtlas?: unknown;
    atlas?: {
      width?: unknown; height?: unknown; columns?: unknown; rows?: unknown;
      frameWidth?: unknown; frameHeight?: unknown; scale?: unknown; rendering?: unknown;
    tileFrameWidth?: unknown; tileFrameHeight?: unknown; tileFrameStartX?: unknown; tileFrameStartY?: unknown;
    };
    frames?: unknown;
    tileFrames?: unknown;
  };
  const atlas = manifest.atlas;
  if (manifest.candidateId !== 'p6-village-plaza'
    || manifest.status !== 'candidate'
    || manifest.approved !== false
    || manifest.runtimeAtlas !== TOWN_SCENE_CANDIDATE_ATLAS_FILE
    || atlas?.width !== 544 || atlas.height !== 256
    || atlas.columns !== 4 || atlas.rows !== 4
    || atlas.frameWidth !== 64 || atlas.frameHeight !== 64
    || atlas.tileFrameWidth !== 32 || atlas.tileFrameHeight !== 32
    || atlas.tileFrameStartX !== 256 || atlas.tileFrameStartY !== 0
    || atlas.scale !== 2 || atlas.rendering !== 'nearest-neighbor'
    || !Array.isArray(manifest.frames)
    || manifest.frames.length !== TOWN_SCENE_CANDIDATE_REQUIRED_FRAMES.length
    || !Array.isArray(manifest.tileFrames)
    || manifest.tileFrames.length !== TOWN_SCENE_CANDIDATE_TILE_FRAMES.length) return null;

  const result: Record<string, FrameRect> = {};
  for (let index = 0; index < manifest.frames.length; index += 1) {
    const raw = manifest.frames[index];
    const expectedId = TOWN_SCENE_CANDIDATE_REQUIRED_FRAMES[index];
    if (!expectedId) return null;
    if (!raw || typeof raw !== 'object') return null;
    const frame = raw as { index?: unknown; id?: unknown; x?: unknown; y?: unknown; width?: unknown; height?: unknown };
    const expectedX = (index % 4) * 64;
    const expectedY = Math.floor(index / 4) * 64;
    if (frame.index !== index || frame.id !== expectedId
      || frame.x !== expectedX || frame.y !== expectedY
      || frame.width !== 64 || frame.height !== 64) return null;
    result[expectedId] = { x: expectedX, y: expectedY, width: 64, height: 64 };
  }
  for (let index = 0; index < manifest.tileFrames.length; index += 1) {
    const raw = manifest.tileFrames[index];
    if (!raw || typeof raw !== 'object') return null;
    const frame = raw as { id?: unknown; x?: unknown; y?: unknown; width?: unknown; height?: unknown; tileable?: unknown; approved?: unknown };
    const expectedId = TOWN_SCENE_CANDIDATE_TILE_FRAMES[index];
    if (!expectedId || frame.id !== expectedId || frame.x !== 256 + index * 32 || frame.y !== 0
      || frame.width !== 32 || frame.height !== 32 || frame.tileable !== true || frame.approved !== false) return null;
    result[expectedId] = { x: 256 + index * 32, y: 0, width: 32, height: 32 };
  }
  return result;
}

/** Return a stable candidate tile frame only for existing town terrain and wall tiles. */
export function townSceneCandidateTileFrameFor(map: MapDef, x: number, y: number, kindOverride?: TileKind): string | null {
  if (map.id !== 'village' && map.id !== 'plaza') return null;
  const kind = kindOverride ?? tileAt(map, x, y)?.kind;
  if (kind === 'wall') return 'wall-stone';
  if (kind === 'grass') {
    const variation = (x * 7 + y * 11) % 19;
    if (variation === 0) return 'grass-flower';
    if (variation < 4) return 'grass-dapple-a';
    if (variation < 8) return 'grass-dapple-b';
    return 'grass-base';
  }
  if (kind === 'path') {
    const alternate = (x + y) % 2 === 1;
    return map.id === 'plaza'
      ? (alternate ? 'plaza-cobble-alt' : 'plaza-cobble')
      : (alternate ? 'path-stone-alt' : 'path-stone');
  }
  return null;
}

/** Large shop buildings remain 2×2 tiles; market stalls and details use smaller footprints. */
export function townSceneCandidateScale(frame: TownSceneCandidateFrame): number {
  if (frame === 'general-store' || frame === 'blacksmith' || frame === 'well') return 2;
  if (frame === 'night-market-stall' || frame === 'traveling-merchant-cart') return 1.25;
  return 1;
}

/** Existing tile icons beneath a candidate overlay are hidden so the same shop/notice is not drawn twice. */
export function townSceneCandidateReplacesTileObject(map: MapDef, x: number, y: number): boolean {
  return (map.id === 'village' || map.id === 'plaza')
    && townSceneCandidatePlacements(map).some(({ anchorTile }) => anchorTile.x === x && anchorTile.y === y);
}

/**
 * Position town art only when its existing map tile still has the authored interaction or
 * decorative meaning. The candidate sprites never supply collision or interaction data.
 */
export function townSceneCandidatePlacements(map: MapDef): readonly TownSceneCandidatePlacement[] {
  if (map.id === 'village') {
    const entries = [
      { frame: 'general-store' as const, anchorTile: { x: 3, y: 4 }, accepts: (tile: TileDef | null | undefined) => tile?.kind === 'shop' && tile.shop === 'general' },
      { frame: 'blacksmith' as const, anchorTile: { x: 12, y: 4 }, accepts: (tile: TileDef | null | undefined) => tile?.kind === 'shop' && tile.shop === 'smithy' },
    ];
    return entries.filter(({ anchorTile, accepts }) => accepts(tileAt(map, anchorTile.x, anchorTile.y)))
      .map(({ frame, anchorTile }) => ({ frame, anchorTile, layer: 'front' }));
  }
  if (map.id !== 'plaza') return [];
  return PLAZA_DECOR.filter(({ anchorTile, accepts }) => accepts(tileAt(map, anchorTile.x, anchorTile.y)))
    .map(({ frame, anchorTile }) => ({ frame, anchorTile, layer: 'front' }));
}
