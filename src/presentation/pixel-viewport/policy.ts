import type { Rect } from '../responsive/metrics';
import { renderProfileFor, type RenderProfile, type RenderProfileId } from './profiles';

export type ViewportOrientation = 'portrait' | 'landscape';
export type ViewportInput = 'touch' | 'pointer';
export type ViewportFit = 'contain' | 'cover';

export interface PixelViewportPolicyInput {
  container: { width: number; height: number };
  /** Safe area in container-local CSS pixels. */
  safeArea: Rect;
  dpr: number;
  orientation: ViewportOrientation;
  profile: RenderProfileId;
  input?: ViewportInput;
  fit?: ViewportFit;
}

export interface PixelViewportPolicy {
  profile: RenderProfile;
  worldTilesVisible: { width: number; height: number };
  renderResolution: { width: number; height: number };
  /** CSS pixels per internal render pixel. */
  cssScale: number;
  /** Physical device pixels per internal render pixel. */
  devicePixelScale: number;
  cssViewport: Rect;
  letterbox: { top: number; right: number; bottom: number; left: number };
  crop: { top: number; right: number; bottom: number; left: number };
  diagnostics: {
    targetTileRange: { min: number; max: number };
    scaleMode: 'integer' | 'fractional';
    fit: ViewportFit;
  };
}

function positiveFinite(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function targetTileRange(orientation: ViewportOrientation, input: ViewportInput): { min: number; max: number } {
  if (orientation === 'portrait') return { min: 8, max: 10 };
  return input === 'touch' ? { min: 12, max: 16 } : { min: 14, max: 20 };
}

/**
 * Calculate a presentation-only pixel viewport. The function never changes world tile
 * coordinates, game state, camera state, or the DOM.
 */
export function calculatePixelViewportPolicy(input: PixelViewportPolicyInput): PixelViewportPolicy {
  const profile = renderProfileFor(input.profile, true);
  const fit = input.fit ?? 'contain';
  const range = targetTileRange(input.orientation, input.input ?? 'pointer');
  const visibleWidth = profile.id === 'legacy' ? 16 : Math.round((range.min + range.max) / 2);
  const safeWidth = positiveFinite(Math.min(input.container.width, input.safeArea.width), 1);
  const safeHeight = positiveFinite(Math.min(input.container.height, input.safeArea.height), 1);
  // Candidate canvases match the safe viewport aspect so Phaser does not stretch
  // a 4:3 backing buffer across the portrait stage.
  const visibleHeight = profile.id === 'legacy' ? 12 : Math.max(1, Math.round(visibleWidth / (safeWidth / safeHeight)));
  const renderWidth = profile.id === 'legacy' ? 1024 : visibleWidth * profile.tilePixels;
  const renderHeight = profile.id === 'legacy' ? 768 : visibleHeight * profile.tilePixels;
  const widthScale = safeWidth / renderWidth;
  const heightScale = safeHeight / renderHeight;
  const cssScale = fit === 'cover' ? Math.max(widthScale, heightScale) : Math.min(widthScale, heightScale);
  const viewportWidth = renderWidth * cssScale;
  const viewportHeight = renderHeight * cssScale;
  const x = input.safeArea.x + (input.safeArea.width - viewportWidth) / 2;
  const y = input.safeArea.y + (input.safeArea.height - viewportHeight) / 2;
  const letterbox = {
    top: Math.max(0, y - input.safeArea.y),
    right: Math.max(0, input.safeArea.x + input.safeArea.width - x - viewportWidth),
    bottom: Math.max(0, input.safeArea.y + input.safeArea.height - y - viewportHeight),
    left: Math.max(0, x - input.safeArea.x),
  };
  const crop = {
    top: Math.max(0, input.safeArea.y - y),
    right: Math.max(0, x + viewportWidth - input.safeArea.x - input.safeArea.width),
    bottom: Math.max(0, y + viewportHeight - input.safeArea.y - input.safeArea.height),
    left: Math.max(0, input.safeArea.x - x),
  };
  const dpr = positiveFinite(input.dpr, 1);
  const devicePixelScale = cssScale * dpr;

  return {
    profile,
    worldTilesVisible: { width: visibleWidth, height: visibleHeight },
    renderResolution: { width: renderWidth, height: renderHeight },
    cssScale,
    devicePixelScale,
    cssViewport: { x, y, width: viewportWidth, height: viewportHeight },
    letterbox,
    crop,
    diagnostics: {
      targetTileRange: range,
      scaleMode: Math.abs(devicePixelScale - Math.round(devicePixelScale)) < 1e-6 ? 'integer' : 'fractional',
      fit,
    },
  };
}
