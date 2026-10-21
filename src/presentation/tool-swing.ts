import { SWING_KINDS, type SwingKind } from '../infrastructure/assets/tool-manifest';
import type { View } from './walk-pose';

export { SWING_KINDS, type SwingKind };

/**
 * 工具揮動與身體前傾：純函式，不依賴 Phaser。做法見 docs/ART_PIPELINE.md「工具揮動的做法」。
 *
 * 角色圖的手臂是畫死的，不能單獨動手臂，所以「手部動作」由三件事合成：
 * 工具圖繞握把旋轉（toolPose）、身體朝目標格前傾（actionLean）、命中的那一刻出現粒子（impactAt）。
 *
 * 長度單位是 2x 母版像素（遊戲內以 0.5 倍顯示）。進度 u 為 0（開始）到 1（結束）。
 * 工具圖畫的是朝右的樣子；朝左用鏡像，所以朝左的姿勢是朝右的精確鏡像。
 */

/** 揮到「命中」的那一刻（0 到 1）：粒子、鏡頭微震、田地狀態的視覺變化都在這一刻發生。 */
const IMPACT: Record<SwingKind, number> = { chop: 0.55, pour: 0.45, sow: 0.4 };

export function impactAt(kind: SwingKind): number {
  return IMPACT[kind];
}

/** 關鍵影格：[進度, 旋轉（弧度，順時針為正）, 水平位移, 垂直位移（向上為負）]。 */
type Key = readonly [u: number, rotation: number, x: number, y: number];

const KEYS: Record<SwingKind, readonly Key[]> = {
  // 鋤頭：先往後舉過肩、停一下，再快速砸下，停住，慢慢收回。
  chop: [
    [0, -0.25, 0, 0],
    [0.3, -1.4, -4, -8],
    [0.42, -1.4, -4, -8],
    [0.55, 0.9, 10, 8],
    [0.7, 0.9, 10, 8],
    [1, 0.25, 0, 0],
  ],
  // 水壺：朝目標傾斜，水倒出來時傾得最多，停一下再放平。
  pour: [
    [0, 0, 0, 0],
    [0.25, 0.9, 2, -4],
    [0.45, 1.05, 4, -4],
    [0.7, 1.05, 4, -4],
    [1, 0, 0, 0],
  ],
  // 種子袋：往上一甩、往前送，種子飛出去的那一刻伸得最遠。
  sow: [
    [0, 0, 0, 0],
    [0.2, -0.3, -2, -8],
    [0.4, 0.35, 12, -2],
    [0.6, 0.1, 6, 0],
    [1, 0, 0, 0],
  ],
};

export interface ToolPose {
  /** 開始與結束的瞬間不顯示工具。 */
  visible: boolean;
  /** 繞握把的旋轉（弧度）。 */
  rotation: number;
  /** 相對於握把位置的位移。 */
  x: number;
  y: number;
  scale: number;
}

export interface ActionLean {
  x: number;
  y: number;
  rotation: number;
  scaleY: number;
}

/** 「減少動態」時的揮動幅度倍率。 */
export function motionFactor(reduced: boolean): number {
  return reduced ? 0.4 : 1;
}

function checkProgress(u: number): void {
  if (!(u >= 0 && u <= 1)) throw new RangeError(`揮動進度必須在 0 到 1 之間：${u}`);
}

/** 把 -0 變成 0（-0 在精確比較時與 0 不同）。 */
function clean(value: number): number {
  return value === 0 ? 0 : value;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 在關鍵影格之間以 smoothstep 內插。 */
function sample(keys: readonly Key[], u: number): { rotation: number; x: number; y: number } {
  for (let i = 1; i < keys.length; i += 1) {
    const [u1, r1, x1, y1] = keys[i] as Key;
    if (u <= u1) {
      const [u0, r0, x0, y0] = keys[i - 1] as Key;
      const t = u1 === u0 ? 1 : smoothstep((u - u0) / (u1 - u0));
      return { rotation: r0 + (r1 - r0) * t, x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
    }
  }
  const last = keys[keys.length - 1] as Key;
  return { rotation: last[1], x: last[2], y: last[3] };
}

/** 朝左是朝右的鏡像：旋轉與水平位移反向。 */
function sideSign(view: View): 1 | -1 {
  return view === 'left' ? -1 : 1;
}

/**
 * 工具在揮動中的姿勢，相對於握把位置。
 * 從正面看工具朝觀看者砸來，所以變大；從背面看是離開，所以變小；兩者的旋轉幅度都較小。
 * @param motion 幅度倍率（1 為正常，「減少動態」時較小）；只縮放旋轉與位移，不影響工具是否顯示。
 */
export function toolPose(kind: SwingKind, u: number, view: View, motion = 1): ToolPose {
  checkProgress(u);
  const keys = KEYS[kind];
  const raw = sample(keys, u);
  const sign = sideSign(view);
  const frontBack = view === 'down' || view === 'up';
  const amplitude = (frontBack ? 0.6 : 1) * motion;

  // 「往前伸了多少」：旋轉在該動作的最小值與最大值之間的位置（0 到 1）。
  const rotations = keys.map((k) => k[1]);
  const lo = Math.min(...rotations);
  const hi = Math.max(...rotations);
  const reach = hi === lo ? 0 : (raw.rotation - lo) / (hi - lo);
  const depth = view === 'down' ? 1 + 0.25 * reach : view === 'up' ? 1 - 0.15 * reach : 1;
  const popIn = Math.min(1, 0.6 + 0.4 * (u / 0.12)); // 剛拿出來時由小變大

  return {
    visible: u > 0 && u < 1,
    rotation: clean(sign * raw.rotation * amplitude),
    x: clean(sign * raw.x * amplitude),
    y: clean(raw.y * amplitude),
    scale: popIn * depth,
  };
}

/** 各種揮動身體前傾的最大位移（2x 像素）與旋轉（弧度）。 */
const LEAN: Record<SwingKind, { distance: number; turn: number }> = {
  chop: { distance: 6, turn: 0.05 },
  pour: { distance: 3, turn: 0.02 },
  sow: { distance: 4, turn: 0.03 },
};

/** 0 → 1（在命中那一刻到頂）→ 0，兩端精確為 0。 */
function bump(u: number, impact: number): number {
  return u <= impact ? smoothstep(u / impact) : 1 - smoothstep((u - impact) / (1 - impact));
}

/**
 * 身體朝目標格前傾：左右看時往側邊、前後看時往上下；左右看時身體順著揮動微微轉動，並在命中時輕輕壓縮。
 * 開始與結束時精確等於靜止，所以動作接得上站立。
 */
export function actionLean(kind: SwingKind, u: number, view: View, motion = 1): ActionLean {
  checkProgress(u);
  const lean = bump(u, IMPACT[kind]) * motion;
  const { distance, turn } = LEAN[kind];
  const sideways = view === 'left' || view === 'right';
  const toward = sideSign(view);
  return {
    x: clean(sideways ? toward * distance * lean : 0),
    y: clean(view === 'down' ? distance * lean : view === 'up' ? -distance * lean : 0),
    rotation: clean(sideways ? toward * turn * lean : 0),
    scaleY: clean(1 - 0.04 * lean),
  };
}
