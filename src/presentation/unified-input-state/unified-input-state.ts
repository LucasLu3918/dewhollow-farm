import type { Direction } from '../../domain/content';

/** Identifies one independently held keyboard key, pointer, or joystick source. */
export type InputSource = string;

export interface HeldDirection {
  source: InputSource;
  direction: Direction;
  /** Increasing order makes the most recently changed hold active. */
  order: number;
}

/** Shared, immutable input state for keyboard and touch adapters. */
export interface UnifiedInputState {
  heldDirections: readonly HeldDirection[];
  preInputDirection: Direction | null;
  /** True after cancellation until fresh directional input arrives. */
  cancelled: boolean;
  sequence: number;
}

export function createUnifiedInputState(): UnifiedInputState {
  return {
    heldDirections: [],
    preInputDirection: null,
    cancelled: false,
    sequence: 0,
  };
}

/** Hold or change one input source; an unchanged hold keeps its existing priority. */
export function holdDirection(state: UnifiedInputState, source: InputSource, direction: Direction): UnifiedInputState {
  const index = state.heldDirections.findIndex((held) => held.source === source);
  const current = index < 0 ? undefined : state.heldDirections[index];
  if (current?.direction === direction) {
    return state.cancelled ? { ...state, cancelled: false } : state;
  }

  const sequence = state.sequence + 1;
  const next: HeldDirection = { source, direction, order: sequence };
  const heldDirections = index < 0
    ? [...state.heldDirections, next]
    : state.heldDirections.map((held, heldIndex) => heldIndex === index ? next : held);
  return { ...state, heldDirections, cancelled: false, sequence };
}

/** Release only the named source, allowing the next most recent hold to resume. */
export function releaseDirection(state: UnifiedInputState, source: InputSource): UnifiedInputState {
  if (!state.heldDirections.some((held) => held.source === source)) return state;
  return {
    ...state,
    heldDirections: state.heldDirections.filter((held) => held.source !== source),
  };
}

/** Keep at most one buffered turn; the latest valid direction replaces the prior one. */
export function setPreInputDirection(state: UnifiedInputState, direction: Direction | null): UnifiedInputState {
  if (state.preInputDirection === direction && (direction === null || !state.cancelled)) return state;
  return {
    ...state,
    preInputDirection: direction,
    cancelled: direction === null ? state.cancelled : false,
  };
}

/** Clear held and buffered input after focus loss, pointer cancellation, or a scene transition. */
export function cancelUnifiedInput(state: UnifiedInputState): UnifiedInputState {
  if (state.heldDirections.length === 0 && state.preInputDirection === null && state.cancelled) return state;
  return {
    heldDirections: [],
    preInputDirection: null,
    cancelled: true,
    sequence: 0,
  };
}

/** Return the latest held direction, or null when no input source is held. */
export function activeDirection(state: UnifiedInputState): Direction | null {
  let latest: HeldDirection | undefined;
  for (const held of state.heldDirections) {
    if (!latest || held.order > latest.order) latest = held;
  }
  return latest?.direction ?? null;
}
