import { describe, expect, it } from 'vitest';
import {
  candidateFrameAtGaitPhase,
  candidateToolImpactCrossed,
  candidateToolFeedback,
  type CandidateDirection,
} from './candidate-sprite-animator';

const DIRECTIONS: CandidateDirection[] = ['down', 'up', 'left', 'right'];

describe('pixel32 候選動畫器', () => {
  it('四個方向的 idle 都選到該方向的基準影格', () => {
    for (const direction of DIRECTIONS) {
      expect(candidateFrameAtGaitPhase(direction, 'idle', 0)).toEqual({
        frame: `${direction}-idle`,
        index: 0,
      });
    }
  });

  it('走路影格依 scheduler 步態相位循環，而非獨立毫秒計時', () => {
    expect(candidateFrameAtGaitPhase('down', 'walk', 0).frame).toBe('down-contact-a');
    expect(candidateFrameAtGaitPhase('down', 'walk', 0.25).frame).toBe('down-passing');
    expect(candidateFrameAtGaitPhase('down', 'walk', 0.5).frame).toBe('down-contact-b');
    expect(candidateFrameAtGaitPhase('down', 'walk', 0.75).frame).toBe('down-passing');
    expect(candidateFrameAtGaitPhase('down', 'walk', 0.999).frame).toBe('down-passing');
    expect(candidateFrameAtGaitPhase('right', 'walk', 0).frame).toBe('right-contact-a');
  });

  it('同一個 tile progress 在 150ms 與 240ms 方案選到同一影格', () => {
    for (const stepDurationMs of [150, 240]) {
      const gaitCycleMs = stepDurationMs * 2;
      const elapsedAtHalfStep = stepDurationMs / 2;
      expect(candidateFrameAtGaitPhase('left', 'walk', elapsedAtHalfStep / gaitCycleMs).frame).toBe('left-passing');
    }
  });

  it('拒絕超出標準化步態相位範圍的數值', () => {
    for (const phase of [-0.01, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => candidateFrameAtGaitPhase('left', 'walk', phase)).toThrow(RangeError);
    }
  });
});

describe('pixel32 候選工具回饋', () => {
  it('即使取樣跳過命中窗口，也會偵測跨過命中點', () => {
    expect(candidateToolImpactCrossed(0.5, 0.8)).toBe(true);
    expect(candidateToolImpactCrossed(0.54, 0.55)).toBe(true);
    expect(candidateToolImpactCrossed(0.55, 0.8)).toBe(false);
  });

  it('命中點進度必須單調且在有效範圍內', () => {
    expect(() => candidateToolImpactCrossed(0.7, 0.6)).toThrow(RangeError);
    expect(() => candidateToolImpactCrossed(-0.1, 0.5)).toThrow(RangeError);
    expect(() => candidateToolImpactCrossed(0.5, 1.1)).toThrow(RangeError);
  });

  it('動作開始與結束不顯示工具，命中點只回報一次性的區間', () => {
    expect(candidateToolFeedback(0, 'down').visible).toBe(false);
    expect(candidateToolFeedback(0.54, 'down').impact).toBe(false);
    expect(candidateToolFeedback(0.55, 'down').impact).toBe(true);
    expect(candidateToolFeedback(0.7, 'down').impact).toBe(false);
    expect(candidateToolFeedback(1, 'down').visible).toBe(false);
  });

  it('左右揮動鏡像且減少動態會降低位移與旋轉', () => {
    const left = candidateToolFeedback(0.55, 'left');
    const right = candidateToolFeedback(0.55, 'right');
    expect(right.x).toBe(-left.x);
    expect(right.rotation).toBe(-left.rotation);
    const reduced = candidateToolFeedback(0.55, 'left', true);
    expect(Math.abs(reduced.rotation)).toBeLessThan(Math.abs(left.rotation));
    expect(Math.abs(reduced.x)).toBeLessThan(Math.abs(left.x));
  });

  it('拒絕超出 0 到 1 範圍的動作進度', () => {
    expect(() => candidateToolFeedback(-0.1, 'up')).toThrow(RangeError);
    expect(() => candidateToolFeedback(1.1, 'up')).toThrow(RangeError);
  });
});
