/**
 * 裝飾與服飾的占位樣式（程式繪製的色塊，不是美術素材，所以不需要登錄 content/assets.json）。
 * 顏色依物品 id；沒有列出的物品用預設色。只影響畫面，規則不看這裡。
 */

const DECOR_COLOR: Record<string, number> = {
  'star-string': 0xffd966,
  'night-canvas': 0x3b4a8c,
  fountain: 0x7fd3e6,
};

const WEAR_COLOR: Record<string, number> = {
  clothes: 0xd9785a,
  'sun-hat': 0xf2c14e,
};

const DEFAULT_DECOR_COLOR = 0xb08968;
const DEFAULT_WEAR_COLOR = 0xffffff;

/** 擺在小屋地板上的裝飾的色塊顏色。 */
export function decorColorOf(itemId: string): number {
  return DECOR_COLOR[itemId] ?? DEFAULT_DECOR_COLOR;
}

/** 穿在角色身上的衣服或帽子的小圖示顏色。 */
export function wearColorOf(itemId: string): number {
  return WEAR_COLOR[itemId] ?? DEFAULT_WEAR_COLOR;
}
