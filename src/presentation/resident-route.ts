import type { MapDef, Point } from '../domain/content';
import { isWalkable, tileAt } from '../domain/world';
import { TILE_SIZE } from './constants';

/**
 * 居民的路線：在地圖的可走格子上做廣度優先搜尋，給出一步一格的路徑，讓居民繞過牆、水與建物。
 * 只是畫面上的移動，不進存檔、不影響規則，所以放在 presentation；純函式，不依賴 Phaser。
 */

/** 四方向，順序固定，讓同樣的輸入永遠得到同一條路。 */
const DIRECTIONS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/**
 * 從 `from` 走到 `goal` 的路線（不含起點、含終點，每一步相鄰）。
 * 找不到路時回傳 null；已經站在終點時回傳空陣列。
 * 門只能當終點：居民不會為了抄近路從屋子的門穿過去。
 */
export function findRoute(map: MapDef, from: Point, goal: Point): Point[] | null {
  if (sameTile(from, goal)) return [];
  if (!enterable(map, goal, goal)) return null;

  const cameFrom = new Map<string, Point>([[keyOf(from), from]]);
  const queue: Point[] = [from];
  for (const here of queue) {
    for (const step of DIRECTIONS) {
      const next = { x: here.x + step.x, y: here.y + step.y };
      const key = keyOf(next);
      if (cameFrom.has(key) || !enterable(map, next, goal)) continue;
      cameFrom.set(key, here);
      if (sameTile(next, goal)) return rebuild(cameFrom, from, goal);
      queue.push(next);
    }
  }
  return null;
}

/**
 * 居民目前站在哪一格，由畫面上的腳底座標推回來（與 `standOf` 互逆）。
 * 走路途中會落在兩格之間，四捨五入到最近的格子當起點。
 */
export function tileOfStand(px: number, py: number): Point {
  return { x: Math.floor(px / TILE_SIZE), y: Math.round(py / TILE_SIZE) - 1 };
}

function enterable(map: MapDef, p: Point, goal: Point): boolean {
  const tile = tileAt(map, p.x, p.y);
  if (!tile || !isWalkable(tile.kind)) return false;
  return tile.kind !== 'door' || sameTile(p, goal);
}

function rebuild(cameFrom: Map<string, Point>, from: Point, goal: Point): Point[] {
  const route: Point[] = [];
  let at = goal;
  while (!sameTile(at, from)) {
    route.push(at);
    at = cameFrom.get(keyOf(at)) ?? from;
  }
  return route.reverse();
}

function keyOf(p: Point): string {
  return `${p.x},${p.y}`;
}

function sameTile(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}
