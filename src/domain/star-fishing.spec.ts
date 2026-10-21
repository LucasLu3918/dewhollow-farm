import { describe, expect, it } from 'vitest';
import { starCatchHit, starPhase, type StarTiming } from './star-fishing';

const TIMING: StarTiming = { cycleMs: 1600, zone: { from: 0.6, to: 0.7 } };

describe('star marker phase (星星在水面上走的位置)', () => {
  it('goes from 0 to just under 1 each cycle, then starts over', () => {
    expect(starPhase(0, 1600)).toBe(0);
    expect(starPhase(800, 1600)).toBe(0.5);
    expect(starPhase(1600, 1600)).toBe(0);
    expect(starPhase(2400, 1600)).toBe(0.5);
  });
});

describe('star catch timing (釣星星的時機，純函式)', () => {
  it('a press inside the zone catches the star, at both edges included', () => {
    expect(starCatchHit(960, TIMING)).toBe(true); // 0.6
    expect(starCatchHit(1120, TIMING)).toBe(true); // 0.7
    expect(starCatchHit(1040, TIMING)).toBe(true);
  });

  it('a press just before or after the zone misses', () => {
    expect(starCatchHit(950, TIMING)).toBe(false); // about 0.594
    expect(starCatchHit(1130, TIMING)).toBe(false); // about 0.706
    expect(starCatchHit(0, TIMING)).toBe(false);
  });

  it('no press (null) misses, and so does a press after the line has run out', () => {
    expect(starCatchHit(null, TIMING)).toBe(false);
    expect(starCatchHit(1600, TIMING)).toBe(false);
    expect(starCatchHit(1040 + 1600, TIMING)).toBe(false);
  });

  it('negative or non-finite times miss', () => {
    expect(starCatchHit(-10, TIMING)).toBe(false);
    expect(starCatchHit(Number.NaN, TIMING)).toBe(false);
    expect(starCatchHit(Number.POSITIVE_INFINITY, TIMING)).toBe(false);
  });
});
