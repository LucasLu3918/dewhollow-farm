export interface Point {
  x: number;
  y: number;
}

/** Snap only the render coordinate; callers retain their unsnapped world position. */
export function snapRenderCoordinate(value: number, outputPixelsPerWorldUnit: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(outputPixelsPerWorldUnit) || outputPixelsPerWorldUnit <= 0) return value;
  return Math.round(value * outputPixelsPerWorldUnit) / outputPixelsPerWorldUnit;
}

/** Apply one output-grid density to both axes for consistent camera or sprite rendering. */
export function snapPointToPixelGrid(point: Point, outputPixelsPerWorldUnit: number): Point {
  return {
    x: snapRenderCoordinate(point.x, outputPixelsPerWorldUnit),
    y: snapRenderCoordinate(point.y, outputPixelsPerWorldUnit),
  };
}
