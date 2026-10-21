/** 地圖格子的像素尺寸（畫面用）。美術路線 B：64 px 手繪卡通。 */
export const TILE_SIZE = 64;

/**
 * 相對於 32 px 設計稿的倍率。效果與占位圖的像素值都以 32 px 為基準撰寫，
 * 乘上它即可；日後再換格子大小時，不需要逐一改數字。
 */
export const UNIT = TILE_SIZE / 32;

/** 一個畫面能看到的格數（鏡頭視窗），固定 4:3。 */
export const VIEW_TILES = { width: 16, height: 12 } as const;

export const VIEW_SIZE = {
  width: VIEW_TILES.width * TILE_SIZE,
  height: VIEW_TILES.height * TILE_SIZE,
} as const;
