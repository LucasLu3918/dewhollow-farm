import { describe, expect, it } from 'vitest';
import { changeAt, clearDaily, effectiveKind, withChange, type WorldChanges } from './world-changes';

describe('world changes', () => {
  it('records a change for one tile on one map, and reads it back', () => {
    const changes = withChange({}, 'forest', 3, 4, 'chopped');
    expect(changeAt(changes, 'forest', 3, 4)).toBe('chopped');
    expect(changeAt(changes, 'forest', 4, 3)).toBeUndefined();
    expect(changeAt(changes, 'farm', 3, 4)).toBeUndefined();
  });

  it('does not change the object it was given', () => {
    const before: WorldChanges = {};
    withChange(before, 'forest', 1, 1, 'picked');
    expect(before).toEqual({});
  });

  it('a chopped tree and a picked forage tile both show as plain grass', () => {
    expect(effectiveKind('tree', 'chopped')).toBe('grass');
    expect(effectiveKind('forage', 'picked')).toBe('grass');
    expect(effectiveKind('tree', undefined)).toBe('tree');
  });

  it('the new day restores picked forage but keeps chopped trees gone', () => {
    const changes = withChange(withChange({}, 'forest', 1, 1, 'chopped'), 'forest', 3, 1, 'picked');
    const next = clearDaily(changes);
    expect(changeAt(next, 'forest', 1, 1)).toBe('chopped');
    expect(changeAt(next, 'forest', 3, 1)).toBeUndefined();
  });
});

describe('mining changes', () => {
  it('a mined rock or ore spot becomes path, and a cleared cave mouth is open path', () => {
    expect(effectiveKind('rock', 'mined')).toBe('path');
    expect(effectiveKind('ore', 'mined')).toBe('path');
    expect(effectiveKind('cave', 'cleared')).toBe('path');
  });
});
