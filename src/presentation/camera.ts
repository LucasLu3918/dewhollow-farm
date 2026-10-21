/** 鏡頭計算：純函式，不依賴 Phaser，方便單元測試。 */

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
