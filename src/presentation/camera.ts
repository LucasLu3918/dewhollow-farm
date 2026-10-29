/** 鏡頭計算：純函式，不依賴 Phaser，方便單元測試。 */
import { TILE_SIZE } from './constants';

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Size {
  x: number;
  y: number;
}

/** 玩家在視窗中央這個比例的範圍內移動時，鏡頭不動。 */
const DEADZONE_RATIO = 0.25;
export const DEFAULT_SCENE_ZOOM_CAP = 2;
export const INTERIOR_TOUCH_SCENE_ZOOM_CAP = 3.25;

/** 以 1024px 設計視窗計算的直式 9 格倍率；實際倍率會依 camera viewport 寬度調整。 */
export const PORTRAIT_TOUCH_ZOOM = 1024 / (9 * TILE_SIZE);

/** 觸控鏡頭依方向保持目標格數；滑鼠版維持既有 1× 視野。 */
export function mapZoomFor(view: { cameraWidth: number; coarse: boolean; portrait: boolean }): number {
  if (!view.coarse) return 1;
  const targetTiles = view.portrait ? 9 : 14;
  const cameraWidth = Number.isFinite(view.cameraWidth) && view.cameraWidth > 0
    ? view.cameraWidth
    : targetTiles * TILE_SIZE;
  return cameraWidth / (targetTiles * TILE_SIZE);
}

/** Adds only the zoom needed to cover a small scene, capped to avoid oversized presentation scale. */
export function sceneZoomFor(
  baseZoom: number,
  map: Size,
  viewport: Size,
  maxZoom = DEFAULT_SCENE_ZOOM_CAP,
): number {
  if (map.width <= 0 || map.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return baseZoom;
  const coverZoom = Math.max(viewport.width / map.width, viewport.height / map.height);
  return Math.min(maxZoom, Math.max(baseZoom, coverZoom));
}

/**
 * 鏡頭可捲動的範圍。地圖大於視窗時就是地圖本身；
 * 地圖小於視窗時，把邊界擴成視窗大小並讓地圖居中，Phaser 就不會把小地圖貼在左上角。
 */
export function cameraBounds(map: Size, view: Size): Rect {
  return {
    x: map.width >= view.width ? 0 : -(view.width - map.width) / 2,
    y: map.height >= view.height ? 0 : -(view.height - map.height) / 2,
    width: Math.max(map.width, view.width),
    height: Math.max(map.height, view.height),
  };
}

export function deadzoneOf(view: Size): Size {
  return { width: view.width * DEADZONE_RATIO, height: view.height * DEADZONE_RATIO };
}
