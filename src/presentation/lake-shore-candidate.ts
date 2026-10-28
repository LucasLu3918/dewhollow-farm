import type { MapDef } from '../domain/content';
import { tileAt } from '../domain/world';

export const LAKE_SHORE_CANDIDATE_QUERY = 'gate1LakeVisual';
export const LAKE_SHORE_CANDIDATE_VALUE = 'p6-061';
export const LAKE_SHORE_CANDIDATE_ATLAS_KEY = 'p6-061-lake-shore-atlas';
export const LAKE_SHORE_CANDIDATE_MANIFEST_KEY = 'p6-061-lake-shore-manifest';
export const LAKE_SHORE_CANDIDATE_REGISTRY_KEY = 'p6-061-lake-shore-enabled';
export const LAKE_SHORE_CANDIDATE_ATLAS_FILE = 'atlas.png';

export const LAKE_SHORE_CANDIDATE_REQUIRED_FRAMES = [
  'water-open',
  'water-ripple-small',
  'water-stone',
  'water-lily',
  'water-pebbles',
  'shore-north',
  'shore-east',
  'shore-south',
  'shore-west',
  'shore-corner-nw',
  'shore-corner-ne',
  'shore-basin',
  'fishing-ripple',
] as const;

export type LakeShoreCandidateFrame = (typeof LAKE_SHORE_CANDIDATE_REQUIRED_FRAMES)[number];

/** A third, exact query gate isolates this unapproved preview from other pixel32 reviews. */
export function lakeShoreCandidateRequested(
  search: URLSearchParams,
  isDev: boolean,
  pixel32RuntimeEnabled: boolean,
): boolean {
  const values = search.getAll(LAKE_SHORE_CANDIDATE_QUERY);
  return isDev && pixel32RuntimeEnabled
    && values.length === 1
    && values[0] === LAKE_SHORE_CANDIDATE_VALUE;
}

/**
 * Return the candidate frame for one existing lake water tile. Map data remains authoritative;
 * adjacent grass/path cells only choose the visual shore edge. The fixed ripple is decorative
 * and does not declare a fishing spot or participate in any gameplay rule.
 */
export function lakeShoreFrameFor(map: MapDef, x: number, y: number): LakeShoreCandidateFrame | null {
  if (map.id !== 'lake' || tileAt(map, x, y)?.kind !== 'water') return null;

  const land = {
    north: isShore(tileAt(map, x, y - 1)?.kind),
    east: isShore(tileAt(map, x + 1, y)?.kind),
    south: isShore(tileAt(map, x, y + 1)?.kind),
    west: isShore(tileAt(map, x - 1, y)?.kind),
  };
  const shoreSides = Object.entries(land).filter(([, adjacent]) => adjacent).map(([side]) => side);

  if (land.north && land.west) return 'shore-corner-nw';
  if (land.north && land.east) return 'shore-corner-ne';
  if (shoreSides.length > 1) return 'shore-basin';
  if (land.north) return 'shore-north';
  if (land.east) return 'shore-east';
  if (land.south) return 'shore-south';
  if (land.west) return 'shore-west';

  // This fixed water cell gives the composition a static ripple sample. It is not fishing metadata.
  if (x === 2 && y === 5) return 'fishing-ripple';
  return waterSurfaceVariationAt(x, y);
}

function isShore(kind: string | undefined): boolean {
  return kind === 'grass' || kind === 'path';
}

/** Sparse position-only accents (4 of 31 hash buckets); never seeded from or written to game state. */
function waterSurfaceVariationAt(x: number, y: number): LakeShoreCandidateFrame {
  const variant = ((x + 1) * 7 + (y + 3) * 11) % 31;
  switch (variant) {
    case 0: return 'water-ripple-small';
    case 1: return 'water-stone';
    case 2: return 'water-lily';
    case 3: return 'water-pebbles';
    default: return 'water-open';
  }
}
