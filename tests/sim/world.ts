import type { Direction, MapDef, Point, TileDef, TileKind } from '../../src/domain/content';
import type { GameState } from '../../src/domain/game-state';
import { isWalkable, tileAt } from '../../src/domain/world';
import { changeAt, effectiveKind } from '../../src/domain/world-changes';
import { mineId, mineLayerOf } from '../../src/domain/mine';
import type { ContentIndex } from '../../src/application/content-index';
import { requirementMet } from '../../src/domain/unlock';

/** 模擬用的地圖座標：地圖 id 加上格子。 */
export interface Pos extends Point {
  mapId: string;
}

export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

/** 找不到（礦坑層還沒生成）時回傳 null，而不是拋出錯誤。 */
export function mapOrNull(index: ContentIndex, mapId: string): MapDef | null {
  try {
    return index.map(mapId);
  } catch {
    return null;
  }
}

export function kindAt(state: GameState, mapId: string, x: number, y: number, tile: TileDef): TileKind {
  return effectiveKind(tile.kind, changeAt(state.worldChanges, mapId, x, y));
}

/** 同 game-commands.ts 的 move：能不能踏上這一格（礦坑的洞口清開後也能走）。 */
export function passable(state: GameState, map: MapDef, x: number, y: number): boolean {
  const tile = tileAt(map, x, y);
  if (!tile) return false;
  if (map.npcs.some((n) => n.x === x && n.y === y)) return false;
  if (tile.kind === 'cave') return changeAt(state.worldChanges, map.id, x, y) === 'cleared';
  return isWalkable(kindAt(state, map.id, x, y, tile));
}

/** 門的解鎖條件還沒符合（門是鎖著的）：走不進去，與 game-commands.ts 的 enter 相同的規則。 */
export function lockedDoor(state: GameState, index: ContentIndex, map: MapDef, x: number, y: number): boolean {
  const tile = tileAt(map, x, y);
  if (!tile?.requires) return false;
  return !requirementMet(tile.requires, state.calendar, state.flags, index.tuning.time.daysPerSeason);
}

/** 踏上門、樓梯或清開的洞口之後會到哪裡（與 game-commands.ts 的 enter 相同的規則）。 */
export function landingOf(state: GameState, index: ContentIndex, map: MapDef, x: number, y: number): { mapId: string; x: number; y: number } | null {
  const tile = tileAt(map, x, y);
  if (!tile || !tile.to) return null;
  const cleared = tile.kind === 'cave' && changeAt(state.worldChanges, map.id, x, y) === 'cleared';
  if (!(tile.kind === 'door' || tile.kind === 'stairs' || cleared)) return null;
  let destinationId = tile.to;
  if (tile.kind === 'cave' && destinationId === mineId(1) && state.mineCheckpoint > 1) {
    destinationId = mineId(state.mineCheckpoint);
  }
  const layer = mineLayerOf(destinationId);
  if (layer !== null && !mapOrNull(index, destinationId)) index.ensureMine(layer, state.mineSeed);
  const destination = mapOrNull(index, destinationId);
  if (!destination) return null;
  const spawn = tile.spawn ?? destination.spawn;
  return { mapId: destination.id, x: spawn.x, y: spawn.y };
}

/** 找出地圖上符合條件（以有效地形判斷）的格子。 */
export function tilesWhere(state: GameState, map: MapDef, pred: (kind: TileKind, tile: TileDef, x: number, y: number) => boolean): Pos[] {
  const found: Pos[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = tileAt(map, x, y);
      if (!tile) continue;
      if (pred(kindAt(state, map.id, x, y, tile), tile, x, y)) found.push({ mapId: map.id, x, y });
    }
  }
  return found;
}

export function isMineMap(mapId: string): boolean {
  return mineLayerOf(mapId) !== null;
}

