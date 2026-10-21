import { describe, expect, it } from 'vitest';
import { SWING_KINDS, actionLean, impactAt, motionFactor, toolPose, type SwingKind } from './tool-swing';
import type { View } from './walk-pose';

const VIEWS: readonly View[] = ['down', 'up', 'left', 'right'];
const SAMPLES = Array.from({ length: 41 }, (_, i) => i / 40);

describe('impactAt', () => {
  it('is a moment strictly inside the swing, so there is a wind-up before and a follow-through after', () => {
    for (const kind of SWING_KINDS) {
      expect(impactAt(kind), kind).toBeGreaterThan(0.2);
      expect(impactAt(kind), kind).toBeLessThan(0.8);
    }
  });

  it('comes later for a hoe than for tossing seeds, because the hoe has a long wind-up', () => {
    expect(impactAt('chop')).toBeGreaterThan(impactAt('sow'));
  });
});

describe('toolPose: visibility and numbers', () => {
  it('shows the tool only while it is being swung, never at the very start or end', () => {
    for (const kind of SWING_KINDS) {
      for (const view of VIEWS) {
        expect(toolPose(kind, 0, view).visible, `${kind} ${view} u0`).toBe(false);
        expect(toolPose(kind, 1, view).visible, `${kind} ${view} u1`).toBe(false);
        expect(toolPose(kind, 0.5, view).visible, `${kind} ${view} u.5`).toBe(true);
      }
    }
  });

  it('only produces finite numbers, with no negative zero, and a sensible size', () => {
    for (const kind of SWING_KINDS) {
      for (const view of VIEWS) {
        for (const u of SAMPLES) {
          const pose = toolPose(kind, u, view);
          for (const value of [pose.rotation, pose.x, pose.y, pose.scale]) {
            expect(Number.isFinite(value)).toBe(true);
            expect(Object.is(value, -0)).toBe(false);
          }
          expect(pose.scale).toBeGreaterThan(0.4);
          expect(pose.scale).toBeLessThan(1.4);
        }
      }
    }
  });

  it('rejects a progress outside 0 to 1 instead of animating garbage', () => {
    for (const u of [-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => toolPose('chop', u, 'right')).toThrow(RangeError);
      expect(() => actionLean('chop', u, 'right')).toThrow(RangeError);
    }
  });
});

describe('toolPose: facing left is the exact mirror of facing right', () => {
  it('negates the rotation and the sideways offset and keeps the rest', () => {
    for (const kind of SWING_KINDS) {
      for (const u of SAMPLES) {
        const right = toolPose(kind, u, 'right');
        const left = toolPose(kind, u, 'left');
        expect(left.rotation, `${kind} u${u}`).toBeCloseTo(-right.rotation, 12);
        expect(left.x, `${kind} u${u}`).toBeCloseTo(-right.x, 12);
        expect(left.y).toBeCloseTo(right.y, 12);
        expect(left.scale).toBeCloseTo(right.scale, 12);
        expect(left.visible).toBe(right.visible);
      }
    }
  });
});

describe('toolPose: a hoe (chop)', () => {
  it('is lifted back first, then comes down hard at the moment of impact', () => {
    const raised = toolPose('chop', 0.3, 'right').rotation;
    const impact = toolPose('chop', impactAt('chop'), 'right').rotation;
    expect(raised).toBeLessThan(-1); // 往後舉過肩
    expect(impact).toBeGreaterThan(0.5); // 往前砸下
  });

  it('never swings back once it has started to come down', () => {
    let previous = Number.NEGATIVE_INFINITY;
    for (const u of SAMPLES.filter((v) => v >= 0.42 && v <= impactAt('chop'))) {
      const rotation = toolPose('chop', u, 'right').rotation;
      expect(rotation).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = rotation;
    }
  });

  it('seen from the front it comes toward the viewer, so it gets bigger; from behind it gets smaller', () => {
    // 0.15：「剛拿出來由小變大」的動作已經結束，之後的大小變化只來自朝向或遠離觀看者。
    const at = impactAt('chop');
    expect(toolPose('chop', at, 'down').scale).toBeGreaterThan(toolPose('chop', 0.15, 'down').scale);
    expect(toolPose('chop', at, 'up').scale).toBeLessThan(toolPose('chop', 0.15, 'up').scale);
  });

  it('pops out from small to full size at the start, whatever way it faces', () => {
    for (const view of VIEWS) {
      expect(toolPose('chop', 0.02, view).scale).toBeLessThan(toolPose('chop', 0.15, view).scale + 0.3);
      expect(toolPose('pour', 0.02, 'right').scale).toBeLessThan(toolPose('pour', 0.12, 'right').scale);
    }
  });
});

describe('toolPose: a watering can (pour)', () => {
  it('tips toward the target and is tipped furthest when the water comes out', () => {
    const rotations = SAMPLES.map((u) => toolPose('pour', u, 'right').rotation);
    const peak = Math.max(...rotations);
    expect(peak).toBeGreaterThan(0.7);
    expect(toolPose('pour', impactAt('pour'), 'right').rotation).toBeGreaterThan(peak * 0.85);
    expect(toolPose('pour', 0.02, 'right').rotation).toBeLessThan(peak * 0.3);
  });
});

describe('toolPose: a seed bag (sow)', () => {
  it('is flicked forward and lifted, reaching furthest at the moment the seeds fly out', () => {
    const at = impactAt('sow');
    const forward = toolPose('sow', at, 'right').x;
    expect(forward).toBeGreaterThan(toolPose('sow', 0.02, 'right').x);
    expect(forward).toBeGreaterThan(toolPose('sow', 0.98, 'right').x);
    expect(Math.min(...SAMPLES.map((u) => toolPose('sow', u, 'right').y))).toBeLessThan(0); // 往上甩
  });
});

describe('toolPose: reduced motion', () => {
  it('scales the size of the swing down, but still shows the tool', () => {
    for (const kind of SWING_KINDS) {
      const full = toolPose(kind, impactAt(kind), 'right');
      const calm = toolPose(kind, impactAt(kind), 'right', 0.4);
      expect(Math.abs(calm.rotation)).toBeCloseTo(Math.abs(full.rotation) * 0.4, 10);
      expect(calm.visible).toBe(true);
    }
  });

  it('is 1 for normal motion and a smaller number when the player asks for less', () => {
    expect(motionFactor(false)).toBe(1);
    expect(motionFactor(true)).toBeGreaterThan(0);
    expect(motionFactor(true)).toBeLessThan(0.6);
  });
});

describe('actionLean (how the body leans into the action)', () => {
  it('is exactly at rest at the start and at the end', () => {
    for (const kind of SWING_KINDS) {
      for (const view of VIEWS) {
        for (const u of [0, 1]) {
          expect(actionLean(kind, u, view), `${kind} ${view} u${u}`).toEqual({ x: 0, y: 0, rotation: 0, scaleY: 1 });
        }
      }
    }
  });

  it('leans toward the target tile at the moment of impact', () => {
    for (const kind of SWING_KINDS) {
      const at = impactAt(kind);
      expect(actionLean(kind, at, 'right').x, kind).toBeGreaterThan(0);
      expect(actionLean(kind, at, 'left').x, kind).toBeLessThan(0);
      expect(actionLean(kind, at, 'down').y, kind).toBeGreaterThan(0);
      expect(actionLean(kind, at, 'up').y, kind).toBeLessThan(0);
    }
  });

  it('presses down a little at impact, and never stretches', () => {
    for (const kind of SWING_KINDS) {
      for (const u of SAMPLES) expect(actionLean(kind, u, 'right').scaleY).toBeLessThanOrEqual(1);
      expect(actionLean(kind, impactAt(kind), 'right').scaleY).toBeLessThan(1);
    }
  });

  it('only leans sideways or up and down, never both, and never far', () => {
    for (const kind of SWING_KINDS) {
      for (const u of SAMPLES) {
        const side = actionLean(kind, u, 'right');
        expect(side.y).toBe(0);
        const front = actionLean(kind, u, 'down');
        expect(front.x).toBe(0);
        expect(Math.abs(side.x)).toBeLessThanOrEqual(10);
        expect(Math.abs(front.y)).toBeLessThanOrEqual(10);
      }
    }
  });

  it('turns the body slightly with the swing only when seen from the side', () => {
    const at = impactAt('chop');
    expect(actionLean('chop', at, 'right').rotation).toBeGreaterThan(0);
    expect(actionLean('chop', at, 'left').rotation).toBeLessThan(0);
    expect(actionLean('chop', at, 'down').rotation).toBe(0);
    expect(actionLean('chop', at, 'up').rotation).toBe(0);
  });

  it('leans less with reduced motion, and not at all when motion is turned off', () => {
    const at = impactAt('chop');
    const full = actionLean('chop', at, 'right');
    expect(actionLean('chop', at, 'right', 0.4).x).toBeCloseTo(full.x * 0.4, 10);
    expect(actionLean('chop', at, 'right', 0)).toEqual({ x: 0, y: 0, rotation: 0, scaleY: 1 });
  });

  it('carries no negative zero anywhere', () => {
    for (const kind of SWING_KINDS) {
      for (const view of VIEWS) {
        for (const u of SAMPLES) {
          for (const value of Object.values(actionLean(kind, u, view))) expect(Object.is(value, -0)).toBe(false);
        }
      }
    }
  });
});

describe('swing kinds', () => {
  it('are the three the tools need today', () => {
    expect([...SWING_KINDS].sort()).toEqual(['chop', 'pour', 'sow'] satisfies SwingKind[]);
  });
});
