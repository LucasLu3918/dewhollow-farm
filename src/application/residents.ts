import type { GameState } from '../domain/game-state';
import { periodOf, spotOf, type Period } from '../domain/schedule';
import type { ContentIndex } from './content-index';

/** 居民在某張地圖上站的格子。 */
export interface ResidentPlacement {
  npcId: string;
  x: number;
  y: number;
}

/** 現在是哪個時段（依目前的分鐘數與內容裡的時段分界）。 */
export function currentPeriod(state: GameState, index: ContentIndex): Period {
  return periodOf(state.calendar.minuteOfDay, index.schedule.periods);
}

/**
 * 目前這張地圖上的居民與他們站的格子：依現在的時段與天氣查行程（見 schedule.ts）。
 * 不在這張地圖、或這個時段沒有行程的居民不出現。
 */
export function residentsOn(state: GameState, index: ContentIndex): ResidentPlacement[] {
  const period = currentPeriod(state, index);
  const found: ResidentPlacement[] = [];
  for (const npc of index.npcs) {
    const spot = spotOf(index.schedule, npc.id, period, state.weather);
    if (spot && spot.mapId === state.mapId) found.push({ npcId: npc.id, x: spot.x, y: spot.y });
  }
  return found;
}

/** 這一格上站的是哪位居民（沒有就是 undefined）。 */
export function residentAt(state: GameState, index: ContentIndex, x: number, y: number): ResidentPlacement | undefined {
  return residentsOn(state, index).find((r) => r.x === x && r.y === y);
}
