import type { GroundKind, MapDef, TileKind } from '../domain/content';
import { tileAt } from '../domain/world';

/** Opaque surfaces fill the grid; all other tile kinds are transparent objects rendered above them. */
const GROUND_KINDS: ReadonlySet<GroundKind> = new Set([
  'grass', 'field', 'path', 'water', 'floor', 'cave', 'wall',
]);

export function isGroundLayer(kind: TileKind): kind is GroundKind {
  return GROUND_KINDS.has(kind as GroundKind);
}

/**
 * Resolve the floor below an object tile. The nearest surrounding ground tile wins; a map-family
 * fallback handles objects enclosed by other objects.
 */
export function groundLayerFor(map: MapDef, x: number, y: number): GroundKind {
  const current = tileAt(map, x, y);
  if (current?.ground) return current.ground;
  if (current && isGroundLayer(current.kind)) return current.kind;

  for (let radius = 1; radius <= Math.max(map.width, map.height); radius += 1) {
    const counts = new Map<GroundKind, number>();
    for (let dy = -radius; dy <= radius; dy += 1) {
      const dx = radius - Math.abs(dy);
      for (const offsetX of dx === 0 ? [0] : [-dx, dx]) {
        const neighbor = tileAt(map, x + offsetX, y + dy);
        if (neighbor && isGroundLayer(neighbor.kind)) counts.set(neighbor.kind, (counts.get(neighbor.kind) ?? 0) + 1);
      }
    }
    if (counts.size) return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'grass';
  }

  if (map.id.startsWith('house') || map.id === 'coop' || map.id === 'cowbarn') return 'floor';
  if (map.id.startsWith('mine')) return 'cave';
  return 'grass';
}
