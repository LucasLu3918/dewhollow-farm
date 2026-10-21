import type { Direction, MapDef, Point } from '../domain/content';
import { isWalkable, neighbor, tileAt } from '../domain/world';

/**
 * 跟隨玩家的寵物：只存在於畫面上，不參與遊戲規則（不擋路、不進存檔），所以邏輯放在 presentation。
 * 純函式，不依賴 Phaser。
 */

/**
 * 玩家走了一步之後，寵物要站的格子：玩家剛離開的那一格。
 * 玩家只是原地轉身（沒移動）時，寵物不動；玩家走到寵物站的格子上時，兩者自然換位。
 */
export function nextPetTile(before: Point, after: Point, pet: Point): Point {
  if (before.x === after.x && before.y === after.y) return { ...pet };
  return { x: before.x, y: before.y };
}

const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const CLOCKWISE: Record<Direction, Direction> = { up: 'right', right: 'down', down: 'left', left: 'up' };
const COUNTER_CLOCKWISE: Record<Direction, Direction> = { up: 'left', left: 'down', down: 'right', right: 'up' };

/**
 * 玩家剛進入一張地圖（或剛讀檔）時，寵物該站的格子：優先站在玩家後面，
 * 其次是順時針的旁邊、逆時針的旁邊，最後才是前面。牆、門、`blocked`（"x,y"，居民與其他夥伴站的格子）都不能站。
 * 沒有任何格子可站時回傳 null。結果是確定的，同樣的情況永遠得到同一格。
 */
export function placeBeside(
  map: MapDef,
  player: Point,
  facing: Direction,
  blocked: ReadonlySet<string> = new Set(),
): Point | null {
  const order: Direction[] = [OPPOSITE[facing], CLOCKWISE[facing], COUNTER_CLOCKWISE[facing], facing];
  for (const direction of order) {
    const spot = neighbor(player, direction);
    const tile = tileAt(map, spot.x, spot.y);
    if (!tile || !isWalkable(tile.kind) || tile.kind === 'door') continue;
    if (blocked.has(`${spot.x},${spot.y}`)) continue;
    return spot;
  }
  return null;
}
