import type { MapDef, Point, TileDef, TileKind } from './content';
import { isWalkable, tileAt } from './world';
import { HOUSE_FULL_MAP_ID, HOUSE_MAP_ID, HOUSE_WING_MAP_ID } from './house';

/**
 * 小屋裡的裝飾擺放（純規則）。裝飾只擺在小屋的空地板上，每格一件，只改變畫面與圖鑑，不影響體力或時間。
 * 擺放不能擋住服務點的動線：床、工作台、廚房、加工台、信箱、衣櫃與門，都要從出生點走得到它旁邊的一格。
 * 擺放紀錄按房間（地圖 id）存在 GameState.decor 裡，見 application/game-commands.ts 的 placeDecor 與 pickUpDecor。
 */

/** 穿戴的角色：目前只有玩家（之後的夥伴再加 id）。 */
export const PLAYER_WEARER = 'player';

export interface DecorPlacement {
  itemId: string;
  x: number;
  y: number;
}

/** 裝飾與服飾的時數估計（分鐘），見 content/decor.json 與 docs/PLAYTIME_PLAN.md。 */
export interface DecorRules {
  placeMinutes: number;
  wearMinutes: number;
}

/** 不能擺的原因代碼（null 表示可以擺）。 */
export type DecorRefusal = 'NOT_IN_HOUSE' | 'NOT_FLOOR' | 'SPAWN' | 'OCCUPIED' | 'BLOCKS_PATH';

/** 可以擺裝飾的房間（小屋的三種格局）。 */
export const HOUSE_ROOMS: readonly string[] = [HOUSE_MAP_ID, HOUSE_WING_MAP_ID, HOUSE_FULL_MAP_ID];

/** 服務點：玩家要站在它旁邊才用得到，所以旁邊一格要走得到。門也算（走出去要經過它）。 */
const SERVICE_KINDS: ReadonlySet<TileKind> = new Set<TileKind>(['bed', 'workbench', 'kitchen', 'workshop', 'shipbox', 'door']);

function keyOf(point: Point): string {
  return `${point.x},${point.y}`;
}

function isServiceTile(tile: TileDef): boolean {
  return SERVICE_KINDS.has(tile.kind) || tile.notice === 'mailbox' || tile.wardrobe === true;
}

/** 這一格擺的裝飾（沒有就是 undefined）。 */
export function decorAt(placed: readonly DecorPlacement[] | undefined, x: number, y: number): DecorPlacement | undefined {
  return placed?.find((p) => p.x === x && p.y === y);
}

/** 從出生點出發、能走到的格子（擺了裝飾的格子、門都不算）。 */
function reachableFrom(map: MapDef, blocked: ReadonlySet<string>): Set<string> {
  const start = map.spawn;
  const seen = new Set<string>([keyOf(start)]);
  const queue: Point[] = [start];
  for (let i = 0; i < queue.length; i += 1) {
    const here = queue[i];
    if (!here) continue;
    const steps: Point[] = [
      { x: here.x + 1, y: here.y },
      { x: here.x - 1, y: here.y },
      { x: here.x, y: here.y + 1 },
      { x: here.x, y: here.y - 1 },
    ];
    for (const next of steps) {
      const k = keyOf(next);
      if (seen.has(k) || blocked.has(k)) continue;
      const tile = tileAt(map, next.x, next.y);
      if (!tile || !isWalkable(tile.kind) || tile.kind === 'door') continue;
      seen.add(k);
      queue.push(next);
    }
  }
  return seen;
}

/** 擺了這些裝飾之後，所有服務點旁邊都還有一格從出生點走得到。 */
export function keepsPathsOpen(map: MapDef, placed: readonly DecorPlacement[]): boolean {
  const reached = reachableFrom(map, new Set(placed.map(keyOf)));
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = tileAt(map, x, y);
      if (!tile || !isServiceTile(tile)) continue;
      const around = [
        `${x + 1},${y}`,
        `${x - 1},${y}`,
        `${x},${y + 1}`,
        `${x},${y - 1}`,
      ];
      if (!around.some((k) => reached.has(k))) return false;
    }
  }
  return true;
}

/** 這一格能不能擺一件裝飾；回傳不能擺的原因（null 表示可以擺）。 */
export function placementRefusal(map: MapDef, placed: readonly DecorPlacement[], point: Point): DecorRefusal | null {
  if (!HOUSE_ROOMS.includes(map.id)) return 'NOT_IN_HOUSE';
  const tile = tileAt(map, point.x, point.y);
  if (!tile || tile.kind !== 'floor') return 'NOT_FLOOR';
  if (point.x === map.spawn.x && point.y === map.spawn.y) return 'SPAWN';
  if (decorAt(placed, point.x, point.y)) return 'OCCUPIED';
  if (!keepsPathsOpen(map, [...placed, { itemId: '', x: point.x, y: point.y }])) return 'BLOCKS_PATH';
  return null;
}

/**
 * 搬進新的房間（擴建）：依序檢查，放得下的留下，放不下的回傳給呼叫的人（放回背包）。
 */
export function carryDecor(map: MapDef, placed: readonly DecorPlacement[]): { kept: DecorPlacement[]; displaced: DecorPlacement[] } {
  const kept: DecorPlacement[] = [];
  const displaced: DecorPlacement[] = [];
  for (const piece of placed) {
    if (placementRefusal(map, kept, piece) === null) kept.push(piece);
    else displaced.push(piece);
  }
  return { kept, displaced };
}
