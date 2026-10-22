import { insetRect, intersectRects, localRect, type Rect, type ViewportMetrics } from './metrics';
import type { ControlsPlacement } from '../../domain/settings';

export type ResponsiveOrientation = 'portrait' | 'landscape';

export interface ResponsiveLayout {
  orientation: ResponsiveOrientation;
  /** Full Phaser design viewport, in local CSS pixels. */
  worldRect: Rect;
  /** Visible safe area after browser chrome, notches and virtual controls. */
  safeRect: Rect;
  /** Touch-control overlays in local CSS pixels. Empty for external controls. */
  controlsRects: Rect[];
  keyboardOpen: boolean;
  pointer: ViewportMetrics['pointers'];
  /** Shared values consumed by DOM CSS and Phaser camera setup. */
  cssTokens: Readonly<Record<string, string>>;
}

const CONTROL_WIDTH = 168;
const CONTROL_HEIGHT = 132;
const CAMERA_GUTTER = 12;
const MIN_CAMERA_VIEW = { width: 160, height: 120 };

/** Compute a stable layout from browser measurements without touching game state or DOM. */
export function layoutFor(metrics: ViewportMetrics, placement: ControlsPlacement): ResponsiveLayout {
  const host = metrics.host;
  const orientation: ResponsiveOrientation = metrics.layoutViewport.width >= metrics.layoutViewport.height ? 'landscape' : 'portrait';
  const visible = localRect(intersectRects(host, metrics.visualViewport), host);
  const safe = insetRect(visible, metrics.safeInsets);
  let safeRect = safe;
  let controlsRects: Rect[] = [];

  if (placement === 'overlay' && safe.width > 0 && safe.height > 0) {
    if (orientation === 'landscape') {
      const side = Math.min(CONTROL_WIDTH, Math.floor(safe.width * 0.28));
      const controlHeight = Math.min(CONTROL_HEIGHT, safe.height);
      controlsRects = [
        { x: safe.x, y: safe.y + (safe.height - controlHeight) / 2, width: side, height: controlHeight },
        { x: safe.x + safe.width - side, y: safe.y + (safe.height - controlHeight) / 2, width: side, height: controlHeight },
      ];
      const inset = Math.min(side + CAMERA_GUTTER, Math.max(0, safe.width / 2));
      safeRect = { x: safe.x + inset, y: safe.y, width: Math.max(0, safe.width - inset * 2), height: safe.height };
    } else {
      const controlHeight = Math.min(CONTROL_HEIGHT, safe.height);
      controlsRects = [{ x: safe.x, y: safe.y + safe.height - controlHeight, width: safe.width, height: controlHeight }];
      safeRect = { ...safe, height: Math.max(0, safe.height - controlHeight - CAMERA_GUTTER) };
    }
  }

  const tokens = {
    '--responsive-viewport-width': `${Math.max(0, host.width)}px`,
    '--responsive-viewport-height': `${Math.max(0, host.height)}px`,
    '--responsive-safe-top': `${safe.y}px`,
    '--responsive-safe-right': `${Math.max(0, host.width - safe.x - safe.width)}px`,
    '--responsive-safe-bottom': `${Math.max(0, host.height - safe.y - safe.height)}px`,
    '--responsive-safe-left': `${safe.x}px`,
    '--responsive-camera-x': `${safeRect.x}px`,
    '--responsive-camera-y': `${safeRect.y}px`,
    '--responsive-camera-width': `${safeRect.width}px`,
    '--responsive-camera-height': `${safeRect.height}px`,
    '--responsive-controls-height': `${controlsRects[0]?.height ?? 0}px`,
  };

  return {
    orientation,
    worldRect: { x: 0, y: 0, width: host.width, height: host.height },
    safeRect,
    controlsRects,
    keyboardOpen: metrics.keyboardOpen,
    pointer: metrics.pointers,
    cssTokens: tokens,
  };
}

/** Convert the local safe rectangle into Phaser's fixed design coordinates and guard tiny viewports. */
export function cameraViewportFor(layout: ResponsiveLayout, design: { width: number; height: number }): Rect {
  const mapped = {
    x: layout.safeRect.x * design.width / Math.max(1, layout.worldRect.width),
    y: layout.safeRect.y * design.height / Math.max(1, layout.worldRect.height),
    width: layout.safeRect.width * design.width / Math.max(1, layout.worldRect.width),
    height: layout.safeRect.height * design.height / Math.max(1, layout.worldRect.height),
  };
  const width = Math.min(design.width, Math.max(Math.min(MIN_CAMERA_VIEW.width, design.width), mapped.width));
  const height = Math.min(design.height, Math.max(Math.min(MIN_CAMERA_VIEW.height, design.height), mapped.height));
  return {
    x: Math.min(design.width - width, Math.max(0, mapped.x - (width - mapped.width) / 2)),
    y: Math.min(design.height - height, Math.max(0, mapped.y - (height - mapped.height) / 2)),
    width,
    height,
  };
}
