import { describe, expect, it } from 'vitest';
import { becameHidden } from './touch-controls';

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
