import { describe, expect, it } from 'vitest';
import { snapPointToPixelGrid, snapRenderCoordinate } from './snapping';

describe('pixel snapping', () => {
  it('snaps a world coordinate to the nearest output pixel while retaining source precision elsewhere', () => {
    expect(snapRenderCoordinate(10.24, 2)).toBe(10);
    expect(snapRenderCoordinate(10.26, 2)).toBe(10.5);
    expect(snapRenderCoordinate(-0.26, 2)).toBe(-0.5);
  });

  it('snaps both axes consistently using the effective output pixel density', () => {
    expect(snapPointToPixelGrid({ x: 3.27, y: -2.61 }, 4)).toEqual({ x: 3.25, y: -2.5 });
  });

  it('leaves coordinates unchanged when output density is not positive and finite', () => {
    expect(snapRenderCoordinate(3.27, 0)).toBe(3.27);
    expect(snapRenderCoordinate(3.27, Number.NaN)).toBe(3.27);
  });
});
