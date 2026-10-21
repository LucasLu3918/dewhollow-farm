import { describe, expect, it } from 'vitest';
import { WALK_PARAM_KEYS } from '../infrastructure/assets/rig-manifest';
import {
  DEFAULT_WALK_PARAMS,
  REST_POSE,
  effectiveSplit,
  footModeOf,
  idlePose,
  walkPose,
  type View,
  type WalkParams,
} from './walk-pose';

const VIEWS: readonly View[] = ['down', 'up', 'left', 'right'];
const STEPS = [0, 1, 2, 3, 4, 5];
/** u 的取樣：0 到 1，含兩端。 */
const SAMPLES = Array.from({ length: 21 }, (_, i) => i / 20);
const P = DEFAULT_WALK_PARAMS;

describe('walkPose: landing', () => {
  it('has no bob, no sway, no stretch and no foot lift when the foot lands (u = 0 and u = 1)', () => {
    for (const view of VIEWS) {
      for (const step of STEPS) {
        for (const u of [0, 1]) {
          expect(walkPose(step, u, view), `${view} step ${step} u ${u}`).toEqual(REST_POSE);
        }
      }
    }
  });

  it('rises by exactly the bob height at the middle of a step', () => {
    for (const view of VIEWS) {
      for (const step of STEPS) expect(walkPose(step, 0.5, view).y).toBeCloseTo(-P.bob, 10);
    }
  });

  it('never dips below the ground line', () => {
    for (const view of VIEWS) {
      for (const step of STEPS) {
        for (const u of SAMPLES) expect(walkPose(step, u, view).y).toBeLessThanOrEqual(0);
      }
    }
  });

  it('flows from one step into the next without a jump', () => {
    for (const view of VIEWS) {
      for (const step of STEPS) expect(walkPose(step, 1, view)).toEqual(walkPose(step + 1, 0, view));
    }
  });
});

describe('walkPose: sway', () => {
  const swayRad = (P.swayDegrees * Math.PI) / 180;

  it('leans to opposite sides on adjacent steps, by the configured angle at mid-step', () => {
    for (const view of VIEWS) {
      for (const step of STEPS) {
        const here = walkPose(step, 0.5, view).rotation;
        const next = walkPose(step + 1, 0.5, view).rotation;
        expect(Math.sign(here), `${view} step ${step}`).toBe(-Math.sign(next));
        expect(Math.abs(here)).toBeCloseTo(swayRad, 10);
        expect(Math.abs(next)).toBeCloseTo(swayRad, 10);
      }
    }
  });

  it('repeats every two steps (one left step and one right step make a full cycle)', () => {
    for (const view of VIEWS) {
      for (const u of SAMPLES) expect(walkPose(2, u, view)).toEqual(walkPose(0, u, view));
    }
  });

  it('treats negative steps by parity too', () => {
    expect(walkPose(-1, 0.5, 'down')).toEqual(walkPose(1, 0.5, 'down'));
    expect(walkPose(-2, 0.3, 'left')).toEqual(walkPose(0, 0.3, 'left'));
  });
});

describe('walkPose: squash and stretch', () => {
  it('stretches a little in the air and keeps the width the opposite way', () => {
    const air = walkPose(0, 0.5, 'down');
    expect(air.scaleY).toBeCloseTo(1 + P.airStretch, 10);
    expect(air.scaleX).toBeCloseTo(1 - P.airStretch / 2, 10);
  });

  it('stays within the configured limits for every sample', () => {
    for (const view of VIEWS) {
      for (const u of SAMPLES) {
        const pose = walkPose(0, u, view);
        expect(pose.scaleY).toBeGreaterThanOrEqual(1);
        expect(pose.scaleY).toBeLessThanOrEqual(1 + P.airStretch + 1e-9);
        expect(pose.scaleX).toBeLessThanOrEqual(1);
        expect(pose.scaleX).toBeGreaterThanOrEqual(1 - P.airStretch / 2 - 1e-9);
      }
    }
  });
});

describe('walkPose: feet in front and back views (split legs)', () => {
  const FRONT_BACK: readonly View[] = ['down', 'up'];

  it('only ever moves a foot block up, never down, so the cut line stays hidden under the skirt', () => {
    for (const view of VIEWS) {
      for (const step of STEPS) {
        for (const u of SAMPLES) {
          const pose = walkPose(step, u, view);
          expect(pose.legA).toBeLessThanOrEqual(0);
          expect(pose.legB).toBeLessThanOrEqual(0);
        }
      }
    }
  });

  it('never lifts both feet at the same time', () => {
    for (const view of FRONT_BACK) {
      for (const step of STEPS) {
        for (const u of SAMPLES) {
          const pose = walkPose(step, u, view);
          // 至少有一隻腳完全在地上（不用乘積判斷：負數乘 0 會得到 -0）。
          expect(pose.legA === 0 || pose.legB === 0, `${view} step ${step} u ${u}`).toBe(true);
        }
      }
    }
  });

  it('lifts foot A on even steps and foot B on odd steps, by the configured height at mid-step', () => {
    for (const view of FRONT_BACK) {
      expect(walkPose(0, 0.5, view)).toMatchObject({ legB: 0 });
      expect(walkPose(0, 0.5, view).legA).toBeCloseTo(-P.lift, 10);
      expect(walkPose(1, 0.5, view)).toMatchObject({ legA: 0 });
      expect(walkPose(1, 0.5, view).legB).toBeCloseTo(-P.lift, 10);
      expect(walkPose(2, 0.5, view).legA).toBeCloseTo(-P.lift, 10);
    }
  });

  it('does not stretch the feet sideways', () => {
    for (const view of FRONT_BACK) {
      for (const u of SAMPLES) expect(walkPose(0, u, view).stretch).toBe(0);
    }
  });
});

describe('walkPose: feet in side views (one block, stretched)', () => {
  const SIDE: readonly View[] = ['left', 'right'];

  it('uses split legs for front and back, and a single stretched block for the sides', () => {
    expect(footModeOf('down')).toBe('split-legs');
    expect(footModeOf('up')).toBe('split-legs');
    expect(footModeOf('left')).toBe('stretch-feet');
    expect(footModeOf('right')).toBe('stretch-feet');
  });

  it('never splits the side feet (foot B stays put) and lifts the whole block a little each step', () => {
    for (const view of SIDE) {
      for (const step of STEPS) {
        for (const u of SAMPLES) {
          const pose = walkPose(step, u, view);
          expect(pose.legB).toBe(0);
          expect(pose.legA).toBeLessThanOrEqual(0);
        }
        expect(walkPose(step, 0.5, view).legA).toBeLessThan(0);
      }
    }
  });

  it('stretches in one direction on even steps and the other on odd steps', () => {
    for (const view of SIDE) {
      expect(walkPose(0, 0.5, view).stretch).toBeCloseTo(P.footStretch, 10);
      expect(walkPose(1, 0.5, view).stretch).toBeCloseTo(-P.footStretch, 10);
    }
  });
});

describe('rest and idle', () => {
  it('has every offset at zero and the scale at one', () => {
    expect(REST_POSE).toEqual({ y: 0, rotation: 0, scaleX: 1, scaleY: 1, legA: 0, legB: 0, stretch: 0 });
  });

  it('does not carry a negative zero anywhere (which would break exact comparisons)', () => {
    for (const view of VIEWS) {
      for (const step of STEPS) {
        for (const u of SAMPLES) {
          for (const value of Object.values(walkPose(step, u, view))) expect(Object.is(value, -0)).toBe(false);
        }
      }
    }
  });

  it('stays exactly at rest until the player has been still for a while', () => {
    expect(idlePose(0)).toEqual(REST_POSE);
    expect(idlePose(P.breatheDelayMs)).toEqual(REST_POSE);
  });

  it('then breathes by a small amount on a fixed period, without moving anything else', () => {
    const quarter = P.breatheDelayMs + P.breathePeriodMs / 4;
    const idle = idlePose(quarter);
    expect(idle.scaleY).toBeCloseTo(1 + P.breatheAmount, 10);
    expect({ ...idle, scaleY: 1 }).toEqual(REST_POSE);
    expect(idlePose(P.breatheDelayMs + P.breathePeriodMs / 2).scaleY).toBeCloseTo(1, 10);
    expect(idlePose(P.breatheDelayMs + (P.breathePeriodMs * 3) / 4).scaleY).toBeCloseTo(1 - P.breatheAmount, 10);
    expect(idlePose(P.breatheDelayMs + P.breathePeriodMs).scaleY).toBeCloseTo(1, 10);
  });

  it('rejects a still time that is negative or not a number', () => {
    expect(() => idlePose(-1)).toThrow(RangeError);
    expect(() => idlePose(Number.NaN)).toThrow(RangeError);
  });

  it('never breathes by more than the configured amount', () => {
    for (let ms = 0; ms < 20_000; ms += 137) {
      expect(Math.abs(idlePose(ms).scaleY - 1)).toBeLessThanOrEqual(P.breatheAmount + 1e-9);
    }
  });
});

describe('effectiveSplit', () => {
  it('uses the split as measured for the front, back and left images', () => {
    expect(effectiveSplit('down', 60, 128)).toBe(60);
    expect(effectiveSplit('up', 60, 128)).toBe(60);
    expect(effectiveSplit('left', 62, 128)).toBe(62);
  });

  it('mirrors the split for the right view, because that image is the left one flipped', () => {
    expect(effectiveSplit('right', 62, 128)).toBe(128 - 62);
    expect(effectiveSplit('right', 62, 128)).toBe(66);
  });

  it('is its own inverse: flipping twice gives the original', () => {
    expect(effectiveSplit('right', effectiveSplit('right', 62, 128), 128)).toBe(62);
  });
});

describe('walk parameters', () => {
  it('can all be overridden from rigs.json, and nothing else can (one list, two places)', () => {
    expect([...WALK_PARAM_KEYS].sort()).toEqual(Object.keys(DEFAULT_WALK_PARAMS).sort());
  });
});

describe('walkPose: parameters and bad input', () => {
  it('follows the parameters it is given', () => {
    const params: WalkParams = { ...P, bob: 10, swayDegrees: 6, lift: 3, airStretch: 0.1, footStretch: 0.3 };
    expect(walkPose(0, 0.5, 'down', params).y).toBeCloseTo(-10, 10);
    expect(walkPose(0, 0.5, 'down', params).rotation).toBeCloseTo((6 * Math.PI) / 180, 10);
    expect(walkPose(0, 0.5, 'down', params).legA).toBeCloseTo(-3, 10);
    expect(walkPose(0, 0.5, 'down', params).scaleY).toBeCloseTo(1.1, 10);
    expect(walkPose(0, 0.5, 'left', params).stretch).toBeCloseTo(0.3, 10);
  });

  it('turns everything off with zero parameters', () => {
    const off: WalkParams = { ...P, bob: 0, swayDegrees: 0, lift: 0, airStretch: 0, footStretch: 0 };
    for (const view of VIEWS) {
      for (const u of SAMPLES) expect(walkPose(1, u, view, off)).toEqual(REST_POSE);
    }
  });

  it('rejects a progress outside 0 to 1 or not a number, instead of animating garbage', () => {
    for (const u of [-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => walkPose(0, u, 'down')).toThrow(RangeError);
    }
  });

  it('rejects a step count that is not a whole number', () => {
    expect(() => walkPose(0.5, 0.5, 'down')).toThrow(RangeError);
    expect(() => walkPose(Number.NaN, 0.5, 'down')).toThrow(RangeError);
  });

  it('does not change the shared default parameters', () => {
    const before = JSON.stringify(DEFAULT_WALK_PARAMS);
    walkPose(3, 0.4, 'left');
    idlePose(5000);
    expect(JSON.stringify(DEFAULT_WALK_PARAMS)).toBe(before);
    expect(Object.isFrozen(DEFAULT_WALK_PARAMS)).toBe(true);
    expect(Object.isFrozen(REST_POSE)).toBe(true);
  });
});
