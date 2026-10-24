import { describe, expect, it } from 'vitest';
import { becameHidden, DirectionalHoldEmitter } from './touch-controls';
import type { Direction } from '../domain/content';

describe('touch control visibility cancellation', () => {
  it('does not treat repeated hidden writes as a hide transition', () => {
    expect(becameHidden(true, true)).toBe(false);
    expect(becameHidden(false, false)).toBe(false);
  });

  it('cancels when controls transition from visible to hidden', () => {
    expect(becameHidden(false, true)).toBe(true);
    expect(becameHidden(true, false)).toBe(false);
  });
});

describe('directional touch hold events', () => {
  it('emits a directional hold, updates it without a release gap, and releases the source', () => {
    const events: Array<[string, Direction | null]> = [];
    const holds = new DirectionalHoldEmitter((source, direction) => events.push([source, direction]));

    holds.set('touch-controls:pointer:4', 'left');
    holds.set('touch-controls:pointer:4', 'left');
    holds.set('touch-controls:pointer:4', 'up');
    holds.release('touch-controls:pointer:4');

    expect(events).toEqual([
      ['touch-controls:pointer:4', 'left'],
      ['touch-controls:pointer:4', 'up'],
      ['touch-controls:pointer:4', null],
    ]);
  });

  it('keeps simultaneous pointer sources independent and releases each active source on cancellation', () => {
    const events: Array<[string, Direction | null]> = [];
    const holds = new DirectionalHoldEmitter((source, direction) => events.push([source, direction]));

    holds.set('touch-controls:pointer:1', 'left');
    holds.set('touch-controls:pointer:2', 'right');
    holds.releaseAll();
    holds.releaseAll();

    expect(events).toEqual([
      ['touch-controls:pointer:1', 'left'],
      ['touch-controls:pointer:2', 'right'],
      ['touch-controls:pointer:1', null],
      ['touch-controls:pointer:2', null],
    ]);
  });
});
