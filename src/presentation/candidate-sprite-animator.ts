/** Pixel32 Gate 1 候選用的方向與動作狀態；不連接正式 CharacterRig。 */
export type CandidateDirection = 'down' | 'up' | 'left' | 'right';
export type CandidateMotion = 'idle' | 'walk';

export interface CandidateFrame {
  frame: string;
  index: 0 | 1 | 2 | 3;
}

export interface CandidateToolFeedback {
  visible: boolean;
  impact: boolean;
  x: number;
  y: number;
  rotation: number;
}

/** 判斷兩次取樣之間是否跨過工具命中點，避免 rAF 跳幀漏掉短窗口。 */
export function candidateToolImpactCrossed(previousProgress: number, currentProgress: number): boolean {
  if (
    !Number.isFinite(previousProgress)
    || !Number.isFinite(currentProgress)
    || previousProgress < 0
    || currentProgress > 1
    || currentProgress < previousProgress
  ) {
    throw new RangeError('工具動作進度必須由 0 到 1 單調遞增');
  }
  return previousProgress < TOOL_IMPACT_AT && currentProgress >= TOOL_IMPACT_AT;
}

const WALK_CYCLE_MS = 220;
const WALK_FRAME_MS = 55;
const TOOL_IMPACT_AT = 0.55;
const TAU = Math.PI * 2;

/** 取得候選 sheet 的影格；四方向各有 idle、兩個接地姿勢與 passing 姿勢。 */
export function candidateFrameAt(
  direction: CandidateDirection,
  motion: CandidateMotion,
  elapsedMs: number,
): CandidateFrame {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new RangeError(`候選動畫時間必須是非負有限數：${elapsedMs}`);
  }

  if (motion === 'idle') return { frame: `${direction}-idle`, index: 0 };

  const phase = elapsedMs % WALK_CYCLE_MS;
  const index = Math.floor(phase / WALK_FRAME_MS) as CandidateFrame['index'];
  const names = ['contact-a', 'passing', 'contact-b', 'passing'] as const;
  return { frame: `${direction}-${names[index]}`, index };
}

/** 候選預覽的工具揮動回饋；只回傳幾何狀態，不改遊戲命令或農地資料。 */
export function candidateToolFeedback(
  progress: number,
  direction: CandidateDirection,
  reducedMotion = false,
): CandidateToolFeedback {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new RangeError(`候選工具動作進度必須在 0 到 1 之間：${progress}`);
  }

  const motion = reducedMotion ? 0.4 : 1;
  const eased = progress * progress * (3 - 2 * progress);
  const side = direction === 'left' ? -1 : 1;
  const lean = Math.sin(Math.PI * progress);
  return {
    visible: progress > 0 && progress < 1,
    impact: progress >= TOOL_IMPACT_AT && progress < TOOL_IMPACT_AT + 0.05,
    x: clean(side * 8 * eased * motion),
    y: clean(-6 * lean * motion),
    rotation: clean(side * (progress <= TOOL_IMPACT_AT ? -1 : 1) * TAU / 8 * motion),
  };
}

function clean(value: number): number {
  return value === 0 ? 0 : value;
}
