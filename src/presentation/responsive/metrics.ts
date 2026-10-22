/** Browser and container measurements used by responsive presentation only. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PointerCapabilities {
  coarse: boolean;
  fine: boolean;
  hover: boolean;
  touchPoints: number;
}

export interface ViewportMetrics {
  /** Layout viewport is used for orientation so an onscreen keyboard cannot flip it. */
  layoutViewport: { width: number; height: number };
  /** Visual viewport is relative to the layout viewport and may shrink for keyboard/zoom. */
  visualViewport: Rect;
  /** Game host bounds in layout-viewport coordinates. */
  host: Rect;
  safeInsets: Insets;
  pointers: PointerCapabilities;
  keyboardOpen: boolean;
}

export function rectRight(rect: Rect): number {
  return rect.x + rect.width;
}

export function rectBottom(rect: Rect): number {
  return rect.y + rect.height;
}

export function intersectRects(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.max(x, Math.min(rectRight(a), rectRight(b)));
  const bottom = Math.max(y, Math.min(rectBottom(a), rectBottom(b)));
  return { x, y, width: right - x, height: bottom - y };
}

export function insetRect(rect: Rect, insets: Insets): Rect {
  const left = Math.max(0, insets.left);
  const top = Math.max(0, insets.top);
  const right = Math.max(0, insets.right);
  const bottom = Math.max(0, insets.bottom);
  const width = Math.max(0, rect.width - left - right);
  const height = Math.max(0, rect.height - top - bottom);
  return { x: rect.x + Math.min(left, rect.width), y: rect.y + Math.min(top, rect.height), width, height };
}

export function localRect(rect: Rect, origin: Pick<Rect, 'x' | 'y'>): Rect {
  return { ...rect, x: rect.x - origin.x, y: rect.y - origin.y };
}

export function scaleRect(rect: Rect, from: Pick<Rect, 'width' | 'height'>, to: Pick<Rect, 'width' | 'height'>): Rect {
  if (from.width <= 0 || from.height <= 0) return { x: 0, y: 0, width: 0, height: 0 };
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  return { x: rect.x * sx, y: rect.y * sy, width: rect.width * sx, height: rect.height * sy };
}
