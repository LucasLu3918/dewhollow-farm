import type { RigDef } from '../infrastructure/assets/rig-manifest';
import { effectiveSplit, footModeOf, type FootMode, type View } from './walk-pose';

/**
 * 一個方向的切塊方式：純資料，不依賴 Phaser，方便測試。
 * 「Region」是圖片上的區域（原始像素）；「at」是這一塊在顯示座標（畫格左上角為 0,0）上的位置。
 * 朝右是朝左圖的水平翻轉：顯示出來的左邊，在原圖上是右邊，所以區域要從另一端取。
 */

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RigLayout {
  view: View;
  mode: FootMode;
  /** 圖片是否水平翻轉後顯示。 */
  flipX: boolean;
  /** 兩隻腳的分界，在顯示座標上。 */
  split: number;
  upper: Region;
  /** 顯示上在左邊的那隻腳（側面不使用）。 */
  legA: Region;
  /** 顯示上在右邊的那隻腳（側面不使用）。 */
  legB: Region;
  /** 整塊腳（側面使用）。 */
  feet: Region;
  at: {
    upper: { x: number; y: number };
    legA: { x: number; y: number };
    legB: { x: number; y: number };
    feet: { x: number; y: number };
  };
}

export function rigLayout(rig: RigDef, view: View): RigLayout {
  const { width, height } = rig.textureSize;
  const { legTop } = rig;
  const lowerHeight = height - legTop;

  // 朝右若沒有自己的分界，就是朝左的翻轉；分界要翻到另一側。
  const mirrored = view === 'right' && rig.splits.right === undefined;
  const measured = mirrored ? rig.splits.left : rig.splits[view];
  if (measured === undefined) throw new Error(`rig ${rig.id} 沒有 ${view} 的 split`);
  const split = mirrored ? effectiveSplit('right', measured, width) : measured;

  const region = (x: number, w: number): Region => ({ x, y: legTop, width: w, height: lowerHeight });
  return {
    view,
    mode: footModeOf(view),
    flipX: mirrored,
    split,
    upper: { x: 0, y: 0, width, height: legTop },
    // 顯示 [0,split) 與 [split,width)；翻轉時對應原圖的 [width-split,width) 與 [0,width-split)。
    legA: mirrored ? region(width - split, split) : region(0, split),
    legB: mirrored ? region(0, width - split) : region(split, width - split),
    feet: region(0, width),
    at: {
      upper: { x: 0, y: 0 },
      legA: { x: 0, y: legTop },
      legB: { x: split, y: legTop },
      feet: { x: 0, y: legTop },
    },
  };
}
