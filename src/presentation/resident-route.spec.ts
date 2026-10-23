import { describe, expect, it } from 'vitest';
import type { MapDef } from '../domain/content';
import { isWalkable, tileAt } from '../domain/world';
import schedules from '../../content/schedules.json';
import { standOf } from './layout';
import { findRoute, tileOfStand } from './resident-route';

/** 測試用小地圖：`.` 草地、`#` 牆、`+` 門、`~` 水。 */
function mapOf(rows: string[]): MapDef {
  return {
    id: 'test',
    name: 'test',
    width: rows[0]?.length ?? 0,
    height: rows.length,
    rows,
    legend: {
      '.': { kind: 'grass' },
      '#': { kind: 'wall' },
      '+': { kind: 'door', to: 'house' },
      '~': { kind: 'water' },
    },
    spawn: { x: 0, y: 0 },
  };
}

/** 每一步都必須是四方向相鄰、落在可走格子上。 */
function expectContiguousWalkable(map: MapDef, from: { x: number; y: number }, route: { x: number; y: number }[]): void {
  let prev = from;
  for (const step of route) {
    expect(Math.abs(step.x - prev.x) + Math.abs(step.y - prev.y)).toBe(1);
    const tile = tileAt(map, step.x, step.y);
    expect(tile && isWalkable(tile.kind)).toBe(true);
    prev = step;
  }
}

describe('findRoute', () => {
  it('returns no steps when the resident is already on the goal', () => {
    const map = mapOf(['...']);
    expect(findRoute(map, { x: 1, y: 0 }, { x: 1, y: 0 })).toEqual([]);
  });

  it('walks straight across open grass, excluding the start and including the goal', () => {
    const map = mapOf(['.....']);
    expect(findRoute(map, { x: 0, y: 0 }, { x: 3, y: 0 })).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it('goes around a wall instead of through it', () => {
    const map = mapOf(['.....', '.###.', '.....']);
    const from = { x: 0, y: 1 };
    const goal = { x: 4, y: 1 };
    const route = findRoute(map, from, goal);
    expect(route).not.toBeNull();
    expect(route).toHaveLength(6); // 最短繞路：上或下各繞一圈，都是 6 步
    expectContiguousWalkable(map, from, route ?? []);
    expect(route?.at(-1)).toEqual(goal);
  });

  it('goes around water as well as walls', () => {
    const map = mapOf(['.~.', '.~.', '...']);
    const route = findRoute(map, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(route).toHaveLength(6);
    expectContiguousWalkable(map, { x: 0, y: 0 }, route ?? []);
  });

  it('returns null when a wall fully encloses the goal', () => {
    const map = mapOf(['.....', '.###.', '.#.#.', '.###.', '.....']);
    expect(findRoute(map, { x: 0, y: 0 }, { x: 2, y: 2 })).toBeNull();
  });

  it('returns null when the goal itself is not walkable', () => {
    const map = mapOf(['...#']);
    expect(findRoute(map, { x: 0, y: 0 }, { x: 3, y: 0 })).toBeNull();
  });

  it('never passes through a door on the way to somewhere else', () => {
    // 門在中間的窄道上：居民不該為了抄近路穿過屋子的門。
    const map = mapOf(['...', '.+.', '...']);
    const route = findRoute(map, { x: 1, y: 0 }, { x: 1, y: 2 });
    expect(route).not.toBeNull();
    expect(route?.some((step) => step.x === 1 && step.y === 1)).toBe(false);
  });

  it('may end on a door when the door is the goal', () => {
    const map = mapOf(['...', '.+.']);
    const route = findRoute(map, { x: 0, y: 0 }, { x: 1, y: 1 });
    expect(route).toHaveLength(2);
    expect(route?.at(-1)).toEqual({ x: 1, y: 1 });
  });

  it('returns the same route every time for the same input', () => {
    const map = mapOf(['.....', '.###.', '.....']);
    const first = findRoute(map, { x: 0, y: 1 }, { x: 4, y: 1 });
    expect(findRoute(map, { x: 0, y: 1 }, { x: 4, y: 1 })).toEqual(first);
  });
});

/** 真實內容的守護：同一張地圖上，行程裡任兩個站位都要走得到，居民才不會因為找不到路而瞬間出現。 */
describe('shipped schedules', () => {
  const maps = import.meta.glob('../../content/maps/*.json', { eager: true, import: 'default' }) as Record<string, MapDef>;
  const { entries } = schedules as { entries: { npcId: string; mapId: string; x: number; y: number }[] };

  it('every pair of scheduled spots on the same map has a walkable route', () => {
    const unreachable: string[] = [];
    for (const a of entries) {
      for (const b of entries) {
        if (a === b || a.npcId !== b.npcId || a.mapId !== b.mapId) continue;
        const map = maps[`../../content/maps/${a.mapId}.json`];
        expect(map, `地圖 ${a.mapId} 應存在`).toBeDefined();
        if (!map) continue;
        if (!findRoute(map, { x: a.x, y: a.y }, { x: b.x, y: b.y })) {
          unreachable.push(`${a.npcId} ${a.mapId} (${a.x},${a.y}) → (${b.x},${b.y})`);
        }
      }
    }
    expect(unreachable).toEqual([]);
  });
});

describe('tileOfStand', () => {
  it('is the inverse of standOf, so a resident at rest maps back to its tile', () => {
    for (const tile of [
      { x: 0, y: 0 },
      { x: 7, y: 3 },
      { x: 12, y: 9 },
    ]) {
      const stand = standOf(tile.x, tile.y);
      expect(tileOfStand(stand.x, stand.y)).toEqual(tile);
    }
  });
});
