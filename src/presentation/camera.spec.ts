import { describe, expect, it } from 'vitest';
import { PORTRAIT_TOUCH_ZOOM, cameraBounds, deadzoneOf, mapZoomFor } from './camera';

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

describe('mapZoomFor', () => {
  it('keeps a touch portrait viewport within the 8–10 tile target', () => {
    const cameraWidth = 1024;
    const zoom = mapZoomFor({ cameraWidth, coarse: true, portrait: true });

    expect(cameraWidth / zoom / 64).toBe(9);
    expect(zoom).toBe(PORTRAIT_TOUCH_ZOOM);
  });

  it('fits 14 tiles across a landscape touch viewport', () => {
    const cameraWidth = 616;
    const zoom = mapZoomFor({ cameraWidth, coarse: true, portrait: false });

    expect(cameraWidth / zoom / 64).toBe(14);
  });

  it('keeps the desktop pointer camera at 1x', () => {
    expect(mapZoomFor({ cameraWidth: 1024, coarse: false, portrait: false })).toBe(1);
  });
});
