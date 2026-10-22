import { describe, expect, it } from 'vitest';
import { nextFocusIndex, restoreDecision } from './panel-dialog';

describe('nextFocusIndex（Tab 循環）', () => {
  it('forward moves one item at a time', () => {
    expect(nextFocusIndex(3, 0, false)).toBe(1);
    expect(nextFocusIndex(3, 1, false)).toBe(2);
  });

  it('forward wraps from the last item back to the first', () => {
    expect(nextFocusIndex(3, 2, false)).toBe(0);
  });

  it('backward moves one item at a time', () => {
    expect(nextFocusIndex(3, 2, true)).toBe(1);
  });

  it('backward wraps from the first item to the last', () => {
    expect(nextFocusIndex(3, 0, true)).toBe(2);
  });

  it('starts at the first item when focus is outside the list (for example on the title)', () => {
    expect(nextFocusIndex(3, -1, false)).toBe(0);
  });

  it('starts at the last item when focus is outside the list and going backward', () => {
    expect(nextFocusIndex(3, -1, true)).toBe(2);
  });

  it('stays on the only item', () => {
    expect(nextFocusIndex(1, 0, false)).toBe(0);
    expect(nextFocusIndex(1, 0, true)).toBe(0);
  });

  it('reports no target when the panel has nothing focusable', () => {
    expect(nextFocusIndex(0, -1, false)).toBe(-1);
    expect(nextFocusIndex(0, -1, true)).toBe(-1);
  });
});

describe('restoreDecision（焦點還原）', () => {
  it('returns focus to the opener when no modal is left and the opener is usable', () => {
    expect(restoreDecision({ modalsLeft: 0, focusWasInside: true, returnTargetUsable: true })).toBe('return');
  });

  it('still returns focus to the opener when focus had already left the panel', () => {
    expect(restoreDecision({ modalsLeft: 0, focusWasInside: false, returnTargetUsable: true })).toBe('return');
  });

  it('gives up when the opener is gone or hidden', () => {
    expect(restoreDecision({ modalsLeft: 0, focusWasInside: true, returnTargetUsable: false })).toBe('none');
  });

  it('hands focus to the modal still open below when focus was inside the one that closed', () => {
    expect(restoreDecision({ modalsLeft: 1, focusWasInside: true, returnTargetUsable: true })).toBe('top');
  });

  it('leaves focus alone while another modal stays open and focus was not in the closed one', () => {
    expect(restoreDecision({ modalsLeft: 1, focusWasInside: false, returnTargetUsable: true })).toBe('none');
  });
});
