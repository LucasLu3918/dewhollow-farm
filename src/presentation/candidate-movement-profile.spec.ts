import { describe, expect, it } from 'vitest';
import { candidateMovementStepDurationMs } from './candidate-movement-profile';

describe('candidateMovementStepDurationMs', () => {
  it('uses the slower candidate duration only for the exact DEV Pixel32 opt-in', () => {
    expect(candidateMovementStepDurationMs(true, true, new URLSearchParams('gate1MovementSpeed=slow'))).toBe(240);
  });

  it('keeps the 150ms baseline outside development or candidate runtime', () => {
    const params = new URLSearchParams('gate1MovementSpeed=slow');
    expect(candidateMovementStepDurationMs(false, true, params)).toBe(150);
    expect(candidateMovementStepDurationMs(true, false, params)).toBe(150);
    expect(candidateMovementStepDurationMs(false, false, params)).toBe(150);
  });

  it('keeps the 150ms baseline for missing, unknown, or duplicate profile parameters', () => {
    expect(candidateMovementStepDurationMs(true, true, new URLSearchParams())).toBe(150);
    expect(candidateMovementStepDurationMs(true, true, new URLSearchParams('gate1MovementSpeed=fast'))).toBe(150);
    expect(candidateMovementStepDurationMs(true, true, new URLSearchParams('gate1MovementSpeed=slow&gate1MovementSpeed=fast'))).toBe(150);
  });
});
