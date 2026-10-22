import { describe, expect, it } from 'vitest';
import { insetRect, intersectRects, scaleRect } from './metrics';
import { cameraViewportFor, layoutFor } from './layout';

const base = {
  layoutViewport: { width: 390, height: 844 },
  visualViewport: { x: 0, y: 0, width: 390, height: 844 },
  host: { x: 0, y: 0, width: 390, height: 844 },
  safeInsets: { top: 24, right: 0, bottom: 20, left: 0 },
  pointers: { coarse: true, fine: false, hover: false, touchPoints: 5 },
  keyboardOpen: false,
} as const;

describe('responsive rectangle helpers', () => {
  it('intersects with non-negative dimensions at disjoint edges', () => {
    expect(intersectRects({ x: 0, y: 0, width: 20, height: 10 }, { x: 30, y: 4, width: 6, height: 6 }))
      .toEqual({ x: 30, y: 4, width: 0, height: 6 });
  });

  it('clamps excessive insets without producing negative sizes', () => {
    expect(insetRect({ x: 5, y: 8, width: 30, height: 20 }, { top: 30, right: 4, bottom: 12, left: 40 }))
      .toEqual({ x: 35, y: 28, width: 0, height: 0 });
  });

  it('scales rectangles independently across both axes', () => {
    expect(scaleRect({ x: 10, y: 20, width: 30, height: 40 }, { width: 100, height: 100 }, { width: 200, height: 50 }))
      .toEqual({ x: 20, y: 10, width: 60, height: 20 });
    expect(scaleRect({ x: 1, y: 1, width: 4, height: 4 }, { width: 0, height: 4 }, { width: 8, height: 8 }))
      .toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe('layoutFor', () => {
  it('uses layout viewport orientation when the visual viewport shrinks for the keyboard', () => {
    const layout = layoutFor({
      ...base,
      layoutViewport: { width: 844, height: 390 },
      host: { x: 0, y: 0, width: 844, height: 390 },
      visualViewport: { x: 0, y: 0, width: 844, height: 180 },
      keyboardOpen: true,
    }, 'external');
    expect(layout.orientation).toBe('landscape');
    expect(layout.keyboardOpen).toBe(true);
    expect(layout.safeRect.height).toBe(156);
  });

  it('keeps the entire world safe with external controls and reserves bottom space for portrait overlays', () => {
    const external = layoutFor(base, 'external');
    const overlay = layoutFor(base, 'overlay');
    expect(external.controlsRects).toEqual([]);
    expect(external.safeRect).toEqual({ x: 0, y: 24, width: 390, height: 800 });
    expect(overlay.controlsRects).toHaveLength(1);
    expect(overlay.safeRect.height).toBeLessThan(external.safeRect.height);
    expect(overlay.cssTokens['--responsive-camera-height']).toBe(`${overlay.safeRect.height}px`);
  });

  it('does not subtract safe insets twice when the host already sits inside the global safe bounds', () => {
    const result = layoutFor({
      ...base,
      safeInsets: { top: 24, right: 16, bottom: 20, left: 16 },
      host: { x: 16, y: 24, width: 358, height: 800 },
    }, 'external');
    expect(result.safeRect).toEqual({ x: 0, y: 0, width: 358, height: 800 });
  });

  it('reserves left and right control columns in landscape overlay mode', () => {
    const result = layoutFor({
      ...base,
      layoutViewport: { width: 844, height: 390 },
      host: { x: 0, y: 0, width: 844, height: 390 },
      visualViewport: { x: 0, y: 0, width: 844, height: 390 },
      safeInsets: { top: 0, right: 10, bottom: 0, left: 12 },
    }, 'overlay');
    expect(result.orientation).toBe('landscape');
    expect(result.controlsRects).toHaveLength(2);
    expect(result.safeRect.x).toBeGreaterThan(12);
    expect(result.safeRect.width).toBeLessThan(844);
  });

  it('keeps a minimum camera matrix inside the design canvas for tiny or hidden hosts', () => {
    const tiny = layoutFor({
      ...base,
      layoutViewport: { width: 180, height: 100 },
      host: { x: 0, y: 0, width: 0, height: 0 },
      visualViewport: { x: 0, y: 0, width: 0, height: 0 },
      safeInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    }, 'overlay');
    const viewport = cameraViewportFor(tiny, { width: 1024, height: 768 });
    expect(viewport).toEqual({ x: 0, y: 0, width: 160, height: 120 });
    expect(viewport.x + viewport.width).toBeLessThanOrEqual(1024);
    expect(viewport.y + viewport.height).toBeLessThanOrEqual(768);
  });
});
