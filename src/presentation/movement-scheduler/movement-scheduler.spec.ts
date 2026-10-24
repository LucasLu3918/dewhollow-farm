import { describe, expect, it } from 'vitest';
import {
  advanceMovement,
  cancelMovement,
  commitStep,
  createMovementScheduler,
  rejectStep,
  requestNextStep,
  queueMovementTap,
  setMovementIntent,
} from './movement-scheduler';

const options = { stepDurationMs: 140, nearEndBufferMs: 50, gaitCycleMs: 240 };

function startStep(direction: 'up' | 'down' | 'left' | 'right' = 'right') {
  let state = createMovementScheduler({ x: 0, y: 0 }, options);
  state = setMovementIntent(state, direction);
  const scheduled = requestNextStep(state);
  if (!scheduled) throw new Error('Expected a movement request');
  return { state: scheduled.state, request: scheduled.request };
}

describe('movement scheduler', () => {
  it('creates committed and visual positions at the initial tile', () => {
    const state = createMovementScheduler({ x: 3, y: 2 }, options);

    expect(state.committedTile).toEqual({ x: 3, y: 2 });
    expect(state.visualPosition).toEqual({ x: 3, y: 2 });
    expect(state.step).toBeNull();
    expect(state.gaitPhase).toBe(0);
  });

  it('produces one request while idle and never dispatches from frame advancement', () => {
    let state = createMovementScheduler({ x: 0, y: 0 }, options);
    state = setMovementIntent(state, 'right');
    const scheduled = requestNextStep(state);
    expect(scheduled?.request).toMatchObject({ direction: 'right', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
    expect(requestNextStep(scheduled!.state)).toBeNull();

    const advanced = advanceMovement(scheduled!.state, 16);
    expect(advanced).toBe(scheduled!.state);
  });

  it('commits the tile on acceptance while visual position interpolates independently', () => {
    const { state, request } = startStep();
    const moving = commitStep(state, request.id);

    expect(moving.committedTile).toEqual({ x: 1, y: 0 });
    expect(moving.visualPosition).toEqual({ x: 0, y: 0 });
    expect(moving.step?.nextTile).toEqual({ x: 1, y: 0 });

    const halfway = advanceMovement(moving, 70);
    expect(halfway.step?.progress).toBe(0.5);
    expect(halfway.visualPosition).toEqual({ x: 0.5, y: 0 });
    expect(halfway.committedTile).toEqual({ x: 1, y: 0 });
  });

  it('buffers only the latest turn during the near-end window', () => {
    const started = startStep();
    let moving = commitStep(started.state, started.request.id);
    moving = advanceMovement(moving, 90);
    moving = setMovementIntent(moving, 'up');
    expect(moving.preInputDirection).toBe('up');
    moving = setMovementIntent(moving, 'left');
    expect(moving.preInputDirection).toBe('left');

    moving = advanceMovement(moving, 60);
    expect(moving.step).toBeNull();
    expect(moving.visualPosition).toEqual({ x: 1, y: 0 });
    const next = requestNextStep(moving);
    expect(next?.request.direction).toBe('left');
    expect(next?.request.to).toEqual({ x: 0, y: 0 });
  });

  it('captures a held turn when entering the near-end window', () => {
    const started = startStep();
    let moving = commitStep(started.state, started.request.id);
    moving = setMovementIntent(moving, 'down');
    expect(moving.preInputDirection).toBeNull();
    moving = advanceMovement(moving, 90);

    expect(moving.preInputDirection).toBe('down');
  });

  it('keeps gait phase continuous across committed steps', () => {
    const started = startStep();
    let moving = commitStep(started.state, started.request.id);
    moving = advanceMovement(moving, 140);
    const firstPhase = moving.gaitPhase;
    expect(firstPhase).toBeCloseTo(140 / 240);

    const next = requestNextStep(moving);
    expect(next?.request.direction).toBe('right');
    moving = commitStep(next!.state, next!.request.id);
    expect(moving.gaitPhase).toBe(firstPhase);
    moving = advanceMovement(moving, 20);
    expect(moving.gaitPhase).toBeCloseTo(160 / 240);
  });

  it('stops after a blocked step and requires fresh input before retrying', () => {
    const started = startStep('up');
    let blocked = rejectStep(started.state, started.request.id);

    expect(blocked.step).toBeNull();
    expect(blocked.committedTile).toEqual({ x: 0, y: 0 });
    expect(blocked.visualPosition).toEqual({ x: 0, y: 0 });
    expect(blocked.facing).toBe('up');
    expect(blocked.blockedDirection).toBe('up');
    expect(requestNextStep(blocked)).toBeNull();

    blocked = setMovementIntent(blocked, 'right');
    expect(requestNextStep(blocked)?.request.direction).toBe('right');
  });

  it('allows the blocked direction again after release and repress', () => {
    const started = startStep('up');
    let blocked = rejectStep(started.state, started.request.id);
    blocked = setMovementIntent(blocked, null);
    blocked = setMovementIntent(blocked, 'up');

    expect(requestNextStep(blocked)?.request.direction).toBe('up');
  });

  it('drops a near-end buffered turn when the direction is released', () => {
    const started = startStep();
    let moving = commitStep(started.state, started.request.id);
    moving = advanceMovement(moving, 90);
    moving = setMovementIntent(moving, 'up');
    expect(moving.preInputDirection).toBe('up');

    moving = setMovementIntent(moving, null);
    expect(moving.preInputDirection).toBeNull();
    moving = advanceMovement(moving, 50);
    expect(requestNextStep(moving)).toBeNull();
  });

  it('preserves a discrete tap received during an active step after the hold is released', () => {
    const started = startStep();
    let moving = commitStep(started.state, started.request.id);
    moving = queueMovementTap(moving, 'left');
    moving = setMovementIntent(moving, null);
    moving = advanceMovement(moving, 150);

    const queued = requestNextStep(moving);
    expect(queued?.request.direction).toBe('left');
    expect(queued?.state.queuedTaps).toEqual([]);
    expect(queued?.request.from).toEqual({ x: 1, y: 0 });
  });

  it('buffers only the latest direction during a burst of taps', () => {
    const started = startStep();
    let queued = started.state;
    for (const direction of ['down', 'left', 'up', 'right', 'down'] as const) {
      queued = queueMovementTap(queued, direction);
    }
    expect(queued.queuedTaps).toEqual(['down']);
    let moving = commitStep(queued, started.request.id);
    moving = advanceMovement(moving, 150);
    const proposal = requestNextStep(moving);
    expect(proposal?.request.direction).toBe('down');
    moving = commitStep(proposal!.state, proposal!.request.id);
    moving = advanceMovement(moving, 150);
    expect(moving.committedTile).toEqual({ x: 1, y: 1 });
    expect(moving.queuedTaps).toEqual([]);
  });

  it('drops queued taps into a direction rejected by the domain', () => {
    const started = startStep();
    let moving = queueMovementTap(started.state, 'right');
    moving = queueMovementTap(moving, 'up');
    const blocked = rejectStep(moving, started.request.id);

    expect(blocked.queuedTaps).toEqual(['up']);
    expect(blocked.blockedDirection).toBe('right');
  });

  it('releasing before the boundary drops the hold without queuing an extra tile', () => {
    const started = startStep();
    let moving = commitStep(started.state, started.request.id);
    moving = advanceMovement(moving, 140);
    moving = setMovementIntent(moving, null);

    expect(requestNextStep(moving)).toBeNull();
  });

  it('cancels a step by settling visual position at the committed tile and invalidates requests', () => {
    const started = startStep();
    const moving = advanceMovement(commitStep(started.state, started.request.id), 60);
    const cancelled = cancelMovement(moving);

    expect(cancelled.visualPosition).toEqual({ x: 1, y: 0 });
    expect(cancelled.committedTile).toEqual({ x: 1, y: 0 });
    expect(cancelled.step).toBeNull();
    expect(cancelled.preInputDirection).toBeNull();
    expect(cancelled.heldDirection).toBeNull();
    expect(requestNextStep(cancelled)).toBeNull();
  });

  it('ignores stale domain results after cancellation', () => {
    const started = startStep();
    const cancelled = cancelMovement(started.state);

    expect(commitStep(cancelled, started.request.id)).toBe(cancelled);
    expect(rejectStep(cancelled, started.request.id)).toBe(cancelled);
  });

  it('completes at most one grid step for a large frame delta', () => {
    const started = startStep();
    const moving = commitStep(started.state, started.request.id);
    const completed = advanceMovement(moving, 1000);

    expect(completed.step).toBeNull();
    expect(completed.committedTile).toEqual({ x: 1, y: 0 });
    expect(completed.visualPosition).toEqual({ x: 1, y: 0 });
    expect(requestNextStep(completed)?.request.to).toEqual({ x: 2, y: 0 });
  });
});
