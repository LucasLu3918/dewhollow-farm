import { describe, expect, it } from 'vitest';
import items from '../../../content/items.json';
import forest from '../../../content/maps/forest.json';
import type { Direction, MapDef, Point } from '../../domain/content';
import { isWalkable, neighbor, tileAt } from '../../domain/world';

/** 春夏可以在森林採到的 10 種野菜與花（M4b）。野薄荷沒有 item 欄位，不在此列。 */
const SPRING_SUMMER_FORAGE = [
  'mushroom',
  'berry',
  'flower-spring',
  'flower-summer',
  'herb',
  'fern-shoot',
  'flower-bell',
  'creek-celery',
  'flower-night',
  'pine-nut',
] as const;

/** 各採集點的季節：'all' 表示四季（tile 沒有 seasons 欄位）。 */
const EXPECTED_SEASONS: Record<(typeof SPRING_SUMMER_FORAGE)[number], readonly string[] | 'all'> = {
  mushroom: ['spring'],
  berry: ['summer'],
  'flower-spring': ['spring'],
  'flower-summer': ['summer'],
  herb: 'all',
  'fern-shoot': ['spring'],
  'flower-bell': ['spring'],
  'creek-celery': ['summer'],
  'flower-night': ['summer'],
  'pine-nut': 'all',
};

const FLOWERS = new Set<string>(['flower-spring', 'flower-summer', 'flower-bell', 'flower-night']);
const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

const forestMap = forest as unknown as MapDef;

interface ForageSpot {
  x: number;
  y: number;
  item: string;
  seasons: readonly string[] | undefined;
}

function forageSpots(): ForageSpot[] {
  const spots: ForageSpot[] = [];
  for (let y = 0; y < forestMap.height; y++) {
    for (let x = 0; x < forestMap.width; x++) {
      const tile = tileAt(forestMap, x, y);
      if (tile?.kind === 'forage' && tile.item !== undefined) {
        spots.push({ x, y, item: tile.item, seasons: tile.seasons });
      }
    }
  }
  return spots;
}

function reachableFromSpawn(): Set<string> {
  const key = (p: Point) => `${p.x},${p.y}`;
  const seen = new Set<string>([key(forestMap.spawn)]);
  const queue: Point[] = [forestMap.spawn];
  while (queue.length > 0) {
    const from = queue.shift() as Point;
    for (const direction of DIRECTIONS) {
      const to = neighbor(from, direction);
      const tile = tileAt(forestMap, to.x, to.y);
      if (!tile || !isWalkable(tile.kind) || seen.has(key(to))) continue;
      seen.add(key(to));
      queue.push(to);
    }
  }
  return seen;
}

describe('春夏的野菜與花（M4b 補足到 10 種）', () => {
  it('the forest offers exactly the 10 spring and summer forage items', () => {
    const offered = [...new Set(forageSpots().map((spot) => spot.item))].sort();
    expect(offered).toEqual([...SPRING_SUMMER_FORAGE].sort());
    expect(offered).toHaveLength(10);
  });

  it('every forage item is defined in items.json as forage, with a sell price in range', () => {
    for (const id of SPRING_SUMMER_FORAGE) {
      const item = items.items.find((i) => i.id === id);
      expect(item, `${id} 必須存在於 items.json`).toBeDefined();
      expect(item?.kind, id).toBe('forage');
      const price = item?.sellPrice ?? -1;
      const [low, high] = FLOWERS.has(id) ? [3, 10] : [5, 10];
      expect(price, `${id} 的售價`).toBeGreaterThanOrEqual(low);
      expect(price, `${id} 的售價`).toBeLessThanOrEqual(high);
    }
  });

  it('every item has the season it is meant to have on its forest spot', () => {
    for (const id of SPRING_SUMMER_FORAGE) {
      const spots = forageSpots().filter((spot) => spot.item === id);
      expect(spots.length, `${id} 至少要有一個採集點`).toBeGreaterThan(0);
      const expected = EXPECTED_SEASONS[id];
      for (const spot of spots) {
        if (expected === 'all') {
          expect(spot.seasons, `${id} 是四季採集點`).toBeUndefined();
        } else {
          expect(spot.seasons, `${id} 的季節`).toEqual(expected);
        }
      }
    }
  });

  it('every walkable tile of the forest, including every new spot, is reachable from the spawn', () => {
    const reached = reachableFromSpawn();
    for (let y = 0; y < forestMap.height; y++) {
      for (let x = 0; x < forestMap.width; x++) {
        const tile = tileAt(forestMap, x, y);
        if (!tile || !isWalkable(tile.kind)) continue;
        expect(reached.has(`${x},${y}`), `(${x},${y}) 走不到`).toBe(true);
      }
    }
  });
});
