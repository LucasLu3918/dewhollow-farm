import type { TileKind } from '../domain/content';

export interface ForestTileAnchor {
  x: number;
  y: number;
}

/** Moss is presentation-only: each anchor already has walkable grass in forest.json. */
export const FOREST_MOSS_TILES: readonly ForestTileAnchor[] = [
  { x: 1, y: 1 },
  { x: 13, y: 1 },
  { x: 11, y: 4 },
  { x: 2, y: 6 },
  { x: 6, y: 8 },
  { x: 8, y: 11 },
  { x: 20, y: 12 },
];

/** Rock illustrations replace existing blocked tree visuals; collision and chopping remain per tile. */
export const FOREST_ROCK_TILES: readonly ForestTileAnchor[] = [
  { x: 4, y: 1 },
  { x: 6, y: 3 },
  { x: 7, y: 10 },
  { x: 3, y: 12 },
  { x: 10, y: 14 },
];

const mossTiles = new Set(FOREST_MOSS_TILES.map(({ x, y }) => `${x},${y}`));
const rockTiles = new Set(FOREST_ROCK_TILES.map(({ x, y }) => `${x},${y}`));

/** Resolves optional art only for the forest; other maps continue to use their shared tile assets. */
export function forestSceneAssetFor(mapId: string, kind: TileKind, x: number, y: number): string | null {
  if (mapId !== 'forest') return null;
  if (kind === 'grass') return mossTiles.has(`${x},${y}`) ? 'scene.forest.moss' : 'scene.forest.grass';
  if (kind === 'path') return 'scene.forest.path';
  // Unbreakable map boundaries use canopy art so the blocked edge reads as forest instead of a dark placeholder tile.
  if (kind === 'wall') return 'scene.forest.tree';
  if (kind === 'tree') return rockTiles.has(`${x},${y}`) ? 'scene.forest.rock' : 'scene.forest.tree';
  return null;
}
