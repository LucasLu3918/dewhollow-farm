import { TILE_SIZE } from './constants';

const DEPTH_ACTOR_BASE = 10;
const DEPTH_PLAYER_TIE_BREAK = 0.001;
const DEPTH_FOREGROUND_TIE_BREAK = 0.001;

export type ActorDepthRole = 'player' | 'resident';

/** Actors lower on the screen render in front; the player wins a same-foot-Y tie. */
export function actorDepth(footY: number, role: ActorDepthRole): number {
  return DEPTH_ACTOR_BASE + footY / TILE_SIZE + (role === 'player' ? DEPTH_PLAYER_TIE_BREAK : 0);
}

/** Trees and front overlays sit just ahead of the player at the same foot anchor. */
export function foregroundDepth(footY: number): number {
  return actorDepth(footY, 'player') + DEPTH_FOREGROUND_TIE_BREAK;
}
