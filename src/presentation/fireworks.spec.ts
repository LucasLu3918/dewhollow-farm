import { describe, expect, it } from 'vitest';
import { burstPoints } from './firework-layout';

describe('firework burst layout (煙火的散開位置)', () => {
  it('returns one point per spark, all at the requested radius from the center', () => {
    const points = burstPoints(8, 20, 0);
    expect(points).toHaveLength(8);
    for (const p of points) expect(Math.hypot(p.dx, p.dy)).toBeCloseTo(20, 5);
  });

  it('spreads the sparks evenly around the circle', () => {
    const points = burstPoints(4, 10, 0);
    expect(points[0]!.dx).toBeCloseTo(10, 5);
    expect(points[0]!.dy).toBeCloseTo(0, 5);
    expect(points[1]!.dx).toBeCloseTo(0, 5);
    expect(points[1]!.dy).toBeCloseTo(10, 5);
  });

  it('turns the whole burst by the rotation', () => {
    const [first] = burstPoints(5, 10, Math.PI / 2);
    expect(first!.dx).toBeCloseTo(0, 5);
    expect(first!.dy).toBeCloseTo(10, 5);
  });

  it('a burst of no sparks is empty', () => {
    expect(burstPoints(0, 10, 0)).toEqual([]);
  });
});
