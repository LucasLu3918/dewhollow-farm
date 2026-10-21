import { describe, expect, it } from 'vitest';
import { pickupPoint } from './pickup-arc';

const FROM = { x: 100, y: 200 };
const TO = { x: 300, y: 60 };

describe('pickupPoint', () => {
  it('starts where the item was picked from, at full size', () => {
    expect(pickupPoint(FROM, TO, 0, 40)).toEqual({ x: 100, y: 200, scale: 1 });
  });

  it('lands on the target, a little smaller', () => {
    const end = pickupPoint(FROM, TO, 1, 40);
    expect(end.x).toBeCloseTo(300, 10);
    expect(end.y).toBeCloseTo(60, 10);
    expect(end.scale).toBeCloseTo(0.55, 10);
  });

  it('arcs upward: halfway it is lifted above the straight line by the full lift', () => {
    const mid = pickupPoint(FROM, TO, 0.5, 40);
    const straightY = (FROM.y + TO.y) / 2;
    expect(mid.y).toBeCloseTo(straightY - 40, 10);
    expect(mid.x).toBeCloseTo(200, 10);
  });

  it('is on the straight line at both ends of the lift (no jump)', () => {
    for (const t of [0, 1]) expect(pickupPoint(FROM, TO, t, 40).y).toBeCloseTo(FROM.y + (TO.y - FROM.y) * t, 10);
  });

  it('shrinks monotonically', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= 20; i += 1) {
      const { scale } = pickupPoint(FROM, TO, i / 20, 40);
      expect(scale).toBeLessThanOrEqual(previous);
      previous = scale;
    }
  });

  it('carries no negative zero, even for a target straight below', () => {
    const p = pickupPoint({ x: 0, y: 0 }, { x: 0, y: 0 }, 0.5, 0);
    expect(Object.is(p.x, -0)).toBe(false);
    expect(Object.is(p.y, -0)).toBe(false);
  });

  it('rejects progress outside 0 to 1', () => {
    for (const t of [-0.1, 1.1, Number.NaN]) expect(() => pickupPoint(FROM, TO, t, 40)).toThrow(RangeError);
  });
});
