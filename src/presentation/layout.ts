import { TILE_SIZE } from './constants';

/** 格子座標與畫面像素的換算。角色比格子高，所以以「腳底」為基準對齊。 */

/** 格子左下角：站立的精靈圖（原點在左下）放在這裡，往上長，腳底貼齊格子底部。 */
export function footOf(x: number, y: number): { x: number; y: number } {
  return { x: x * TILE_SIZE, y: (y + 1) * TILE_SIZE };
}

/** 格子正中央，鏡頭看的位置。 */
export function centerOf(x: number, y: number): { x: number; y: number } {
  return { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 };
}
