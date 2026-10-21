import { describe, expect, it } from 'vitest';
import { cameraBounds, deadzoneOf } from './camera';

const view = { width: 1024, height: 768 };

describe('cameraBounds', () => {
  it('uses the map itself when it is larger than the view', () => {
    expect(cameraBounds({ width: 2048, height: 1536 }, view)).toEqual({ x: 0, y: 0, width: 2048, height: 1536 });
  });

  it('uses the map itself when it is exactly the view size', () => {
    expect(cameraBounds(view, view)).toEqual({ x: 0, y: 0, width: 1024, height: 768 });
  });

  it('centres a map that is smaller than the view', () => {
    // 512×384 的地圖放進 1024×768 的視窗：左右各留 256、上下各留 192。
    expect(cameraBounds({ width: 512, height: 384 }, view)).toEqual({ x: -256, y: -192, width: 1024, height: 768 });
  });

  it('handles each axis on its own', () => {
    expect(cameraBounds({ width: 2048, height: 384 }, view)).toEqual({ x: 0, y: -192, width: 2048, height: 768 });
    expect(cameraBounds({ width: 512, height: 1536 }, view)).toEqual({ x: -256, y: 0, width: 1024, height: 1536 });
  });
});

describe('deadzoneOf', () => {
  it('is a fraction of the view so the camera only moves near the edges', () => {
    expect(deadzoneOf(view)).toEqual({ width: 256, height: 192 });
  });
});
