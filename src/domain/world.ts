import type { Direction, MapDef, Point, TileDef, TileKind } from './content';

const WALKABLE: ReadonlySet<TileKind> = new Set<TileKind>(['grass', 'field', 'path', 'door']);

export function tileAt(map: MapDef, x: number, y: number): TileDef | null {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
  const row = map.rows[y];
  const symbol = row?.[x];
  if (symbol === undefined) return null;
  return map.legend[symbol] ?? null;
}

export function isWalkable(kind: TileKind): boolean {
  return WALKABLE.has(kind);
}

const STEP: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function neighbor(from: Point, direction: Direction): Point {
  const step = STEP[direction];
  return { x: from.x + step.x, y: from.y + step.y };
}
