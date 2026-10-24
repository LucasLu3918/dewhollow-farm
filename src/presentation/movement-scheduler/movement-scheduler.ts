import type { Direction } from '../../domain/content';

/** Grid-space coordinates. The presentation adapter converts these to world pixels. */
export interface TilePosition {
  x: number;
  y: number;
}

export interface MovementSchedulerOptions {
  /** Duration of one visual grid step. */
  stepDurationMs?: number;
  /** Time before a step ends during which a held turn is buffered. */
  nearEndBufferMs?: number;
  /** Duration of one full gait cycle, independent of tile boundaries. */
  gaitCycleMs?: number;
  initialFacing?: Direction;
}

export interface MovementStepRequest {
  id: number;
  direction: Direction;
  from: TilePosition;
  to: TilePosition;
}

export interface ActiveMovementStep {
  direction: Direction;
  from: TilePosition;
  nextTile: TilePosition;
  elapsedMs: number;
  durationMs: number;
  progress: number;
}

/**
 * Pure presentation state for grid movement. Domain commands are requested by the
 * consumer through requestNextStep and confirmed through commitStep/rejectStep.
 */
export interface MovementSchedulerState {
  /** Advances as soon as the consumer confirms a successful domain move. */
  committedTile: TilePosition;
  /** Interpolated tile-space position; it may be fractional while a step is active. */
  visualPosition: TilePosition;
  step: ActiveMovementStep | null;
  heldDirection: Direction | null;
  /** One latest turn buffered for the current in-flight step. */
  preInputDirection: Direction | null;
  facing: Direction;
  /** A rejected direction cannot retry until input changes or is released. */
  blockedDirection: Direction | null;
  /** Normalized phase in [0, 1), accumulated across adjacent movement steps. */
  gaitPhase: number;
  stepDurationMs: number;
  nearEndBufferMs: number;
  gaitCycleMs: number;
  nextRequestId: number;
  pendingRequest: MovementStepRequest | null;
/** The one explicit tap buffered during a step, independent of held-direction state. */
  queuedTaps: readonly Direction[];
}

export function createMovementScheduler(
  initialTile: TilePosition,
  options: MovementSchedulerOptions = {},
): MovementSchedulerState {
  const tile = copyPosition(initialTile);
  const stepDurationMs = positive(options.stepDurationMs, 140);
  const gaitCycleMs = positive(options.gaitCycleMs, stepDurationMs * 2);
  return {
    committedTile: tile,
    visualPosition: copyPosition(tile),
    step: null,
    heldDirection: null,
    preInputDirection: null,
    facing: options.initialFacing ?? 'down',
    blockedDirection: null,
    gaitPhase: 0,
    stepDurationMs,
    nearEndBufferMs: Math.min(stepDurationMs, nonNegative(options.nearEndBufferMs, 70)),
    gaitCycleMs,
    nextRequestId: 1,
    pendingRequest: null,
    queuedTaps: [],
  };
}

/** Update the one resolved movement intent supplied by the unified input layer. */
export function setMovementIntent(state: MovementSchedulerState, direction: Direction | null): MovementSchedulerState {
  if (direction === state.heldDirection && !(direction === null && state.blockedDirection !== null)) return state;

  let blockedDirection = state.blockedDirection;
  let preInputDirection = state.preInputDirection;
  if (direction === null) {
    blockedDirection = null;
    preInputDirection = null;
  } else {
    if (blockedDirection !== direction) blockedDirection = null;
    if (state.step) {
      if (direction === state.step.direction) {
        preInputDirection = null;
      } else if (remainingMs(state.step) <= state.nearEndBufferMs) {
        preInputDirection = direction;
      }
    }
  }

  return { ...state, heldDirection: direction, blockedDirection, preInputDirection };
}

/** Preserve a discrete key/button tap that arrives while an earlier step is active. */
export function queueMovementTap(state: MovementSchedulerState, direction: Direction): MovementSchedulerState {
  return { ...state, queuedTaps: [direction] };
}

/**
 * Return and reserve at most one grid-step proposal. Calling this from a frame
 * update is safe: an outstanding request suppresses duplicate domain dispatches.
 */
export function requestNextStep(
  state: MovementSchedulerState,
): { state: MovementSchedulerState; request: MovementStepRequest } | null {
  if (state.step || state.pendingRequest) return null;
  const queuedTap = state.queuedTaps[0];
  const direction = queuedTap ?? state.preInputDirection ?? state.heldDirection;
  if (!direction || direction === state.blockedDirection) return null;

  const request: MovementStepRequest = {
    id: state.nextRequestId,
    direction,
    from: copyPosition(state.committedTile),
    to: adjacentTile(state.committedTile, direction),
  };
  return {
    state: {
      ...state,
      preInputDirection: null,
      queuedTaps: queuedTap ? state.queuedTaps.slice(1) : state.queuedTaps,
      nextRequestId: state.nextRequestId + 1,
      pendingRequest: request,
    },
    request,
  };
}

/** Confirm that the corresponding domain move succeeded and begin visual interpolation. */
export function commitStep(
  state: MovementSchedulerState,
  requestId: number,
  durationMs = state.stepDurationMs,
): MovementSchedulerState {
  const request = state.pendingRequest;
  if (!request || request.id !== requestId) return state;

  const duration = positive(durationMs, state.stepDurationMs);
  return {
    ...state,
    committedTile: copyPosition(request.to),
    step: {
      direction: request.direction,
      from: copyPosition(state.visualPosition),
      nextTile: copyPosition(request.to),
      elapsedMs: 0,
      durationMs: duration,
      progress: 0,
    },
    facing: request.direction,
    blockedDirection: null,
    pendingRequest: null,
  };
}

/** Reject a blocked domain move, face the attempted direction, and stop held movement. */
export function rejectStep(state: MovementSchedulerState, requestId: number): MovementSchedulerState {
  const request = state.pendingRequest;
  if (!request || request.id !== requestId) return state;
  return {
    ...state,
    heldDirection: null,
    preInputDirection: null,
    facing: request.direction,
    blockedDirection: request.direction,
    pendingRequest: null,
    queuedTaps: state.queuedTaps.filter((direction) => direction !== request.direction),
  };
}

/** Advance visual position and gait phase; this function never emits domain requests. */
export function advanceMovement(state: MovementSchedulerState, deltaMs: number): MovementSchedulerState {
  const step = state.step;
  if (!step || !Number.isFinite(deltaMs) || deltaMs <= 0) return state;

  const elapsedMs = Math.min(step.durationMs, step.elapsedMs + deltaMs);
  const progress = elapsedMs / step.durationMs;
  const remaining = step.durationMs - elapsedMs;
  const preInputDirection = state.heldDirection && state.heldDirection !== step.direction && remaining <= state.nearEndBufferMs
    ? state.heldDirection
    : state.preInputDirection;
  const gaitPhase = (state.gaitPhase + (Math.min(deltaMs, step.durationMs - step.elapsedMs) / state.gaitCycleMs)) % 1;

  if (progress >= 1) {
    return {
      ...state,
      visualPosition: copyPosition(step.nextTile),
      step: null,
      preInputDirection,
      gaitPhase,
    };
  }

  return {
    ...state,
    visualPosition: {
      x: step.from.x + (step.nextTile.x - step.from.x) * progress,
      y: step.from.y + (step.nextTile.y - step.from.y) * progress,
    },
    step: { ...step, elapsedMs, progress },
    preInputDirection,
    gaitPhase,
  };
}

/** Stop scheduling input and settle the visual position on the committed grid tile. */
export function cancelMovement(state: MovementSchedulerState): MovementSchedulerState {
  return {
    ...state,
    visualPosition: copyPosition(state.committedTile),
    step: null,
    heldDirection: null,
    preInputDirection: null,
    blockedDirection: null,
    pendingRequest: null,
    queuedTaps: [],
  };
}

function adjacentTile(tile: TilePosition, direction: Direction): TilePosition {
  switch (direction) {
    case 'up': return { x: tile.x, y: tile.y - 1 };
    case 'down': return { x: tile.x, y: tile.y + 1 };
    case 'left': return { x: tile.x - 1, y: tile.y };
    case 'right': return { x: tile.x + 1, y: tile.y };
  }
}

function remainingMs(step: ActiveMovementStep): number {
  return step.durationMs - step.elapsedMs;
}

function copyPosition(position: TilePosition): TilePosition {
  return { x: position.x, y: position.y };
}

function positive(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegative(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;
}
