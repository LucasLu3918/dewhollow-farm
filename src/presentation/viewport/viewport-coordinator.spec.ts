import { describe, expect, it } from 'vitest';
import { layoutFor } from '../responsive/layout';
import type { ViewportMetrics } from '../responsive/metrics';
import { ViewportCoordinator, type ViewportCoordinatorPort } from './viewport-coordinator';

const metrics = (width: number, height: number, touch: boolean): ViewportMetrics => ({
  layoutViewport: { width, height },
  visualViewport: { x: 0, y: 0, width, height },
  host: { x: 0, y: 0, width, height },
  safeInsets: { top: 0, right: 0, bottom: 0, left: 0 },
  pointers: { coarse: touch, fine: !touch, hover: !touch, touchPoints: touch ? 1 : 0 },
  keyboardOpen: false,
});

function fakePort(size: { width: number; height: number }): ViewportCoordinatorPort & {
  size: { width: number; height: number };
  calls: { gameSize: number; viewport: number; zoom: number; deadzone: number };
} {
  const port = {
    size: { ...size },
    calls: { gameSize: 0, viewport: 0, zoom: 0, deadzone: 0 },
    gameSize() { return this.size; },
    setGameSize(next: { width: number; height: number }) {
      this.calls.gameSize += 1;
      this.size = { ...next };
    },
    setCameraViewport() { this.calls.viewport += 1; },
    setCameraZoom() { this.calls.zoom += 1; },
    setCameraDeadzone() { this.calls.deadzone += 1; },
  };
  return port;
}

describe('ViewportCoordinator', () => {
  it('applies the same layout idempotently without repeatedly resizing the backing game', () => {
    const coordinator = new ViewportCoordinator();
    const layout = layoutFor(metrics(390, 844, true), 'external');
    const input = { layout, profile: 'legacy' as const, dpr: 3 };
    const port = fakePort({ width: 1024, height: 768 });

    const first = coordinator.apply(input, port);
    const second = coordinator.apply(input, port);

    expect(second).toEqual(first);
    expect(first.pixelViewport.renderResolution).toEqual({
      width: first.pixelViewport.worldTilesVisible.width * 64,
      height: first.pixelViewport.worldTilesVisible.height * 64,
    });
    expect(first.cameraViewport.width).toBeGreaterThan(0);
    expect(first.deadzone.width).toBeCloseTo(first.cameraViewport.width / first.zoom * 0.25);
    expect(port.size).toEqual(first.pixelViewport.renderResolution);
    expect(port.calls).toEqual({ gameSize: 1, viewport: 2, zoom: 2, deadzone: 2 });
  });

  it('uses the selected profile and viewport orientation to derive the camera plan', () => {
    const coordinator = new ViewportCoordinator();
    const portrait = coordinator.calculate({
      layout: layoutFor(metrics(390, 844, true), 'external'), profile: 'pixel32', dpr: 3,
    });
    const desktop = coordinator.calculate({
      layout: layoutFor(metrics(1920, 1080, false), 'external'), profile: 'pixel16', dpr: 2,
    });

    expect(portrait.touchInput).toBe(true);
    expect(portrait.pixelViewport.renderResolution.width).toBe(portrait.pixelViewport.worldTilesVisible.width * 32);
    expect(portrait.cameraViewport.x).toBeGreaterThanOrEqual(0);
    expect(portrait.cameraViewport.y).toBeGreaterThanOrEqual(0);
    expect(portrait.zoom).toBeGreaterThan(0);
    expect(desktop.touchInput).toBe(false);
    expect(desktop.pixelViewport.profile.id).toBe('pixel16');
    expect(desktop.cameraViewport.width).toBeGreaterThan(0);
    expect(desktop.deadzone.height).toBeGreaterThan(0);
  });
});
