import type { TileKind } from './content';

/**
 * 玩家造成的地圖變化：被砍掉的樹（永久）與被採過的野薄荷（隔日恢復）。
 * 鍵為 "地圖,x,y"，值為變化的種類。地圖本身（content/maps）不會被改動。
 */
export type WorldChange = 'chopped' | 'picked' | 'mined' | 'cleared';
export type WorldChanges = Record<string, WorldChange>;

const keyOf = (mapId: string, x: number, y: number): string => `${mapId},${x},${y}`;

export function withChange(changes: WorldChanges, mapId: string, x: number, y: number, change: WorldChange): WorldChanges {
  return { ...changes, [keyOf(mapId, x, y)]: change };
}

export function changeAt(changes: WorldChanges, mapId: string, x: number, y: number): WorldChange | undefined {
  return changes[keyOf(mapId, x, y)];
}

/** 新的一天：採過的野薄荷會長回來，砍掉的樹不會。 */
export function clearDaily(changes: WorldChanges): WorldChanges {
  const next: WorldChanges = {};
  for (const [key, change] of Object.entries(changes)) {
    if (change !== 'picked') next[key] = change;
  }
  return next;
}

/**
 * 有變化的格子看起來是什麼：樹被砍成空地、野薄荷被採走是草地；石頭與礦石被敲掉是礦坑的路；
 * 洞口的落石清開後也是路（走進去的動作由應用層判斷，見 game-commands.ts）。
 */
export function effectiveKind(base: TileKind, change: WorldChange | undefined): TileKind {
  if (!change) return base;
  return change === 'mined' || change === 'cleared' ? 'path' : 'grass';
}
