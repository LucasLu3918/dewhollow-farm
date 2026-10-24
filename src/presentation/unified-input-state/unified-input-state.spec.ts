import { describe, expect, it } from 'vitest';
import type { Direction } from '../../domain/content';
import {
  activeDirection,
  createUnifiedInputState,
  holdDirection,
  releaseDirection,
  setPreInputDirection,
  cancelUnifiedInput,
} from './unified-input-state';

describe('unified input state', () => {
  it('starts with no held or pre-input direction', () => {
    const state = createUnifiedInputState();

    expect(state.heldDirections).toEqual([]);
    expect(activeDirection(state)).toBeNull();
    expect(state.preInputDirection).toBeNull();
    expect(state.cancelled).toBe(false);
  });

  it('uses the most recently pressed or changed held direction', () => {
    let state = createUnifiedInputState();
    state = holdDirection(state, 'keyboard-up', 'up');
    state = holdDirection(state, 'touch-left', 'left');
    expect(activeDirection(state)).toBe('left');

    // Repeated input from the same source does not steal priority.
    state = holdDirection(state, 'keyboard-up', 'up');
    expect(activeDirection(state)).toBe('left');

    state = holdDirection(state, 'keyboard-up', 'down');
    expect(activeDirection(state)).toBe('down');
  });

  it('falls back to the newest remaining hold when a source is released', () => {
    let state = createUnifiedInputState();
    state = holdDirection(state, 'keyboard', 'up');
    state = holdDirection(state, 'touch', 'right');
    state = releaseDirection(state, 'touch');

    expect(activeDirection(state)).toBe('up');
    expect(state.heldDirections).toEqual([{ source: 'keyboard', direction: 'up', order: 1 }]);
  });

  it('keeps one pre-input direction, replacing it with the latest direction', () => {
    let state = createUnifiedInputState();
    const first: Direction = 'up';
    state = setPreInputDirection(state, first);
    state = setPreInputDirection(state, 'right');

    expect(state.preInputDirection).toBe('right');
    state = setPreInputDirection(state, null);
    expect(state.preInputDirection).toBeNull();
  });

  it('cancels every held direction and the pre-input direction', () => {
    let state = createUnifiedInputState();
    state = holdDirection(state, 'keyboard-up', 'up');
    state = holdDirection(state, 'touch-down', 'down');
    state = setPreInputDirection(state, 'left');

    state = cancelUnifiedInput(state);

    expect(state.heldDirections).toEqual([]);
    expect(activeDirection(state)).toBeNull();
    expect(state.preInputDirection).toBeNull();
    expect(state.cancelled).toBe(true);
  });

  it('marks fresh input after cancellation as active again', () => {
    let state = cancelUnifiedInput(createUnifiedInputState());
    state = holdDirection(state, 'keyboard', 'down');

    expect(state.cancelled).toBe(false);
    expect(activeDirection(state)).toBe('down');
  });
});
