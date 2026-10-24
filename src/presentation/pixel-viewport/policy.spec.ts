import { describe, expect, it } from 'vitest';
import { calculatePixelViewportPolicy } from './policy';

describe('calculatePixelViewportPolicy', () => {
  const container = { width: 390, height: 844 };
  const safeArea = { x: 0, y: 24, width: 390, height: 800 };

  it('selects a portrait field of view within the initial 8–10 tile target', () => {
    const result = calculatePixelViewportPolicy({ container, safeArea, dpr: 3, orientation: 'portrait', profile: 'pixel32' });

    expect(result.worldTilesVisible.width).toBeGreaterThanOrEqual(8);
    expect(result.worldTilesVisible.width).toBeLessThanOrEqual(10);
    expect(result.renderResolution.width).toBe(result.worldTilesVisible.width * 32);
    expect(result.renderResolution.height).toBe(result.worldTilesVisible.height * 32);
    expect(result.worldTilesVisible.height).toBeGreaterThan(10);
    expect(result.cssScale).toBeGreaterThan(0);
    expect(result.devicePixelScale).toBeCloseTo(result.cssScale * 3);
  });

  it('uses orientation and input capability targets for landscape touch and desktop', () => {
    const landscape = calculatePixelViewportPolicy({
      container: { width: 844, height: 390 }, safeArea: { x: 0, y: 0, width: 844, height: 390 },
      dpr: 2, orientation: 'landscape', profile: 'pixel32', input: 'touch',
    });
    const desktop = calculatePixelViewportPolicy({
      container: { width: 1440, height: 900 }, safeArea: { x: 0, y: 0, width: 1440, height: 900 },
      dpr: 1, orientation: 'landscape', profile: 'pixel32', input: 'pointer',
    });

    expect(landscape.worldTilesVisible.width).toBeGreaterThanOrEqual(12);
    expect(landscape.worldTilesVisible.width).toBeLessThanOrEqual(16);
    expect(desktop.worldTilesVisible.width).toBeGreaterThanOrEqual(14);
    expect(desktop.worldTilesVisible.width).toBeLessThanOrEqual(20);
  });

  it('keeps the legacy render target stable and reports centered letterboxing', () => {
    const result = calculatePixelViewportPolicy({
      container: { width: 800, height: 600 }, safeArea: { x: 20, y: 30, width: 760, height: 540 },
      dpr: 1, orientation: 'landscape', profile: 'legacy', input: 'pointer', fit: 'contain',
    });

    expect(result.profile.tilePixels).toBe(64);
    expect(result.renderResolution).toEqual({ width: 1024, height: 768 });
    expect(result.cssViewport.x).toBeGreaterThanOrEqual(20);
    expect(result.cssViewport.y).toBeGreaterThanOrEqual(30);
    expect(result.cssViewport.x + result.cssViewport.width).toBeLessThanOrEqual(780);
    expect(result.cssViewport.y + result.cssViewport.height).toBeLessThanOrEqual(570);
    expect(result.diagnostics.scaleMode).toMatch(/integer|fractional/);
  });

  it('sets legacy touch FOV targets without changing its 64px render asset scale', () => {
    const portrait = calculatePixelViewportPolicy({
      container: { width: 390, height: 844 }, safeArea: { x: 0, y: 24, width: 390, height: 800 },
      dpr: 2, orientation: 'portrait', profile: 'legacy', input: 'touch',
    });
    const landscape = calculatePixelViewportPolicy({
      container: { width: 844, height: 390 }, safeArea: { x: 0, y: 0, width: 844, height: 390 },
      dpr: 2, orientation: 'landscape', profile: 'legacy', input: 'touch',
    });

    expect(portrait.worldTilesVisible.width).toBe(9);
    expect(portrait.worldTilesVisible.height).toBeGreaterThan(10);
    expect(portrait.renderResolution.width).toBe(9 * 64);
    expect(portrait.renderResolution.height).toBe(portrait.worldTilesVisible.height * 64);
    expect(landscape.worldTilesVisible.width).toBe(14);
    expect(landscape.renderResolution.width).toBe(14 * 64);
    expect(landscape.renderResolution.height).toBe(landscape.worldTilesVisible.height * 64);
  });

  it('supports cover by reporting the amount cropped outside the safe area', () => {
    const result = calculatePixelViewportPolicy({
      container: { width: 800, height: 600 }, safeArea: { x: 0, y: 0, width: 800, height: 600 },
      dpr: 1, orientation: 'landscape', profile: 'pixel32', input: 'pointer', fit: 'cover',
    });

    expect(result.diagnostics.fit).toBe('cover');
    expect(Object.values(result.letterbox).every((value) => value === 0)).toBe(true);
    expect(Math.max(...Object.values(result.crop))).toBeGreaterThan(0);
  });

  it('clamps invalid dimensions and DPR to finite usable policy values', () => {
    const result = calculatePixelViewportPolicy({
      container: { width: 0, height: -4 }, safeArea: { x: 0, y: 0, width: 0, height: 0 },
      dpr: Number.NaN, orientation: 'portrait', profile: 'pixel16',
    });

    expect(result.worldTilesVisible.width).toBeGreaterThan(0);
    expect(result.renderResolution.width).toBeGreaterThan(0);
    expect(Number.isFinite(result.cssScale)).toBe(true);
    expect(Number.isFinite(result.devicePixelScale)).toBe(true);
  });
});
