import { describe, expect, it } from 'vitest';
import { focusRestoreTarget, nextFocusIndex, restoreDecision, type FocusSlot } from './panel-dialog';

const btn = (key: string | null = null): FocusSlot => ({ key, disabled: false, interactive: true });
const off = (key: string | null = null): FocusSlot => ({ key, disabled: true, interactive: false });
const text = (key: string): FocusSlot => ({ key, disabled: false, interactive: false });

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

describe('focusRestoreTarget（重畫後的焦點還原）', () => {
  it('prefers the interactive element with the same key over the index', () => {
    const slots = [btn('a'), btn('b'), btn('c')];
    expect(focusRestoreTarget({ key: 'c', interactiveIndex: 0 }, slots, true)).toEqual({ kind: 'slot', index: 2 });
  });

  it('falls back to the same interactive index when the key is gone', () => {
    const slots = [btn('a'), btn('x'), btn('y')];
    expect(focusRestoreTarget({ key: 'gone', interactiveIndex: 1 }, slots, true)).toEqual({ kind: 'slot', index: 1 });
  });

  it('falls back to the title only when there is no interactive element to land on', () => {
    expect(focusRestoreTarget({ key: null, interactiveIndex: -1 }, [], true)).toEqual({ kind: 'title' });
  });

  it('never chooses a disabled button, even when its key matches', () => {
    const slots = [off('a'), btn('b')];
    expect(focusRestoreTarget({ key: 'a', interactiveIndex: 0 }, slots, true)).toEqual({ kind: 'slot', index: 1 });
  });

  it('moves to the text of the same row when its button became disabled', () => {
    const slots = [text('a'), off('a'), btn('b')];
    expect(focusRestoreTarget({ key: 'a', interactiveIndex: 0 }, slots, true)).toEqual({ kind: 'slot', index: 0 });
  });

  it('picks the next interactive element by index when the disabled row has no text anchor', () => {
    const slots = [btn('b'), off('a'), btn('c')];
    expect(focusRestoreTarget({ key: 'a', interactiveIndex: 1 }, slots, true)).toEqual({ kind: 'slot', index: 2 });
  });

  it('clamps the index to the last interactive element when the list got shorter', () => {
    const slots = [btn('a')];
    expect(focusRestoreTarget({ key: null, interactiveIndex: 4 }, slots, true)).toEqual({ kind: 'slot', index: 0 });
  });

  it('goes to the title when the list has no interactive element', () => {
    expect(focusRestoreTarget({ key: null, interactiveIndex: 0 }, [off(), text('a')], true)).toEqual({ kind: 'title' });
  });

  it('does nothing when there are no candidates and no title', () => {
    expect(focusRestoreTarget({ key: 'a', interactiveIndex: 0 }, [], false)).toEqual({ kind: 'none' });
    expect(focusRestoreTarget({ key: null, interactiveIndex: -1 }, [], false)).toEqual({ kind: 'none' });
  });

  it('does nothing when focus was not inside the panel before the redraw', () => {
    expect(focusRestoreTarget(null, [btn('a')], true)).toEqual({ kind: 'none' });
  });
});
