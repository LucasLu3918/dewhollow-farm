import type { Direction } from '../domain/content';

/**
 * 走路姿勢：純函式，不依賴 Phaser，只算「這一刻角色該擺成什麼樣子」。
 * 做法與參數的由來見 docs/ANIMATION_DESIGN.md；實際套到圖片上的是之後的 character-rig。
 *
 * 長度單位是 2x 母版的像素（遊戲內以 0.5 倍顯示，所以 4 = 遊戲內 2 像素）。
 * 上下（y）以「向上為負」計，與 Phaser 一致。
 */

export type View = Direction;

/** 腳的做法：正面、背面把兩隻腳切開輪流抬；側面兩隻鞋重疊，切開會撕裂，整塊不拆改用水平伸縮。 */
export type FootMode = 'split-legs' | 'stretch-feet';

export interface WalkParams {
  /** 上下起伏的高度。 */
  bob: number;
  /** 左右傾斜的最大角度（度）。 */
  swayDegrees: number;
  /** 離地最高點時 Y 方向拉長的比例（X 反向縮小一半，視覺上體積大致不變）。 */
  airStretch: number;
  /** 正面、背面抬腳的高度。 */
  lift: number;
  /** 側面腳部水平伸縮的最大比例。 */
  footStretch: number;
  /** 站定多久後開始呼吸（毫秒）。 */
  breatheDelayMs: number;
  /** 呼吸一個來回的時間（毫秒）。 */
  breathePeriodMs: number;
  /** 呼吸時 Y 方向縮放的最大幅度。 */
  breatheAmount: number;
}

export const DEFAULT_WALK_PARAMS: Readonly<WalkParams> = Object.freeze({
  bob: 4,
  swayDegrees: 3.2,
  airStretch: 0.045,
  lift: 7,
  footStretch: 0.14,
  breatheDelayMs: 3000,
  breathePeriodMs: 2000,
  breatheAmount: 0.015,
});

export interface WalkPose {
  /** 整個角色的垂直位移；落地為 0，離地時為負。 */
  y: number;
  /** 以腳底中心為軸的傾斜（弧度）。 */
  rotation: number;
  scaleX: number;
  scaleY: number;
  /** 腳塊 A 的垂直位移（≤ 0，只往上）。側面時是整塊腳。 */
  legA: number;
  /** 腳塊 B 的垂直位移（≤ 0，只往上）。側面時永遠為 0。 */
  legB: number;
  /** 側面腳部的水平伸縮量（0 為原樣，正為伸長）；正面、背面永遠為 0。 */
  stretch: number;
}

/** 靜止的姿勢：全部位移為 0、縮放為 1。落地的瞬間也等於它，所以走路與靜止之間不會跳一下。 */
export const REST_POSE: Readonly<WalkPose> = Object.freeze({
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  legA: 0,
  legB: 0,
  stretch: 0,
});

/** 側面整塊腳抬起的高度，相對於 lift 的比例（側面只需要輕輕一抬）。 */
const SIDE_LIFT_RATIO = 0.45;

export function footModeOf(view: View): FootMode {
  return view === 'left' || view === 'right' ? 'stretch-feet' : 'split-legs';
}

/**
 * 兩隻腳的分界 x。量測是針對正面、背面、朝左的圖；
 * 朝右用的是朝左圖的水平翻轉，分界也要跟著翻到另一側。
 */
export function effectiveSplit(view: View, split: number, textureWidth: number): number {
  return view === 'right' ? textureWidth - split : split;
}

/**
 * 走一步的姿勢。
 *
 * @param step 累計步數；奇偶決定這一步是哪隻腳（偶數步抬腳 A、奇數步抬腳 B）。
 * @param u 這一步的進度，0（腳剛落地）到 1（下一腳落地）。
 */
export function walkPose(step: number, u: number, view: View, params: Readonly<WalkParams> = DEFAULT_WALK_PARAMS): WalkPose {
  if (!Number.isInteger(step)) throw new RangeError(`步數必須是整數：${step}`);
  if (!(u >= 0 && u <= 1)) throw new RangeError(`步伐進度必須在 0 到 1 之間：${u}`);

  // 兩步一個循環：phase = (step + u) / 2，s = sin(2π·phase) = (-1)^step · sin(πu)。
  const parity = ((step % 2) + 2) % 2;
  const sign = parity === 0 ? 1 : -1;
  const bounce = sinPi(u); // 每一步一個半圓弧：落地 0 → 最高 1 → 落地 0
  const s = sign * bounce;

  const base = {
    y: clean(-params.bob * bounce),
    rotation: clean(sign * bounce * ((params.swayDegrees * Math.PI) / 180)),
    scaleX: clean(1 - (params.airStretch * bounce) / 2),
    scaleY: clean(1 + params.airStretch * bounce),
  };

  if (footModeOf(view) === 'stretch-feet') {
    return {
      ...base,
      legA: clean(-params.lift * SIDE_LIFT_RATIO * bounce),
      legB: 0,
      stretch: clean(params.footStretch * s),
    };
  }
  return {
    ...base,
    legA: clean(-params.lift * Math.max(0, s)),
    legB: clean(-params.lift * Math.max(0, -s)),
    stretch: 0,
  };
}

/**
 * 站著不動時的姿勢：先完全靜止，站定超過一段時間才開始輕輕呼吸。
 * @param stillMs 已經站定多久（毫秒）。
 */
export function idlePose(stillMs: number, params: Readonly<WalkParams> = DEFAULT_WALK_PARAMS): WalkPose {
  if (!Number.isFinite(stillMs) || stillMs < 0) throw new RangeError(`站定時間必須是不小於 0 的數字：${stillMs}`);
  if (stillMs <= params.breatheDelayMs) return REST_POSE;
  const t = (stillMs - params.breatheDelayMs) / params.breathePeriodMs;
  return { ...REST_POSE, scaleY: 1 + params.breatheAmount * Math.sin(2 * Math.PI * t) };
}

/** sin(π·u)，但兩端精確為 0（浮點的 sin(π) 是 1.2e-16，會讓落地姿勢不等於靜止姿勢）。 */
function sinPi(u: number): number {
  return u === 0 || u === 1 ? 0 : Math.sin(Math.PI * u);
}

/** 把 -0 變成 0：-0 在精確比較（Object.is、toBe）時與 0 不同，會造成難查的差異。 */
function clean(value: number): number {
  return value === 0 ? 0 : value;
}
