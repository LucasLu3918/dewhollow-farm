import { describe, expect, it } from 'vitest';
import type { RigDef } from '../infrastructure/assets/rig-manifest';
import { rigLayout } from './rig-layout';
import type { View } from './walk-pose';

const rig: RigDef = {
  id: 'player',
  textureSize: { width: 128, height: 160 },
  legTop: 130,
  views: { down: 'player.down', up: 'player.up', left: 'player.left', right: 'player.right' },
  splits: { down: 60, up: 60, left: 62 },
};

const VIEWS: readonly View[] = ['down', 'up', 'left', 'right'];

describe('rigLayout: front and back (split legs)', () => {
  it('cuts the picture into an upper body and two feet at the leg line', () => {
    const layout = rigLayout(rig, 'down');
    expect(layout.mode).toBe('split-legs');
    expect(layout.flipX).toBe(false);
    expect(layout.split).toBe(60);
    expect(layout.upper).toEqual({ x: 0, y: 0, width: 128, height: 130 });
    expect(layout.legA).toEqual({ x: 0, y: 130, width: 60, height: 30 });
    expect(layout.legB).toEqual({ x: 60, y: 130, width: 68, height: 30 });
  });

  it('places each piece where it came from, so nothing moves at rest', () => {
    const layout = rigLayout(rig, 'up');
    expect(layout.at.upper).toEqual({ x: 0, y: 0 });
    expect(layout.at.legA).toEqual({ x: 0, y: 130 });
    expect(layout.at.legB).toEqual({ x: 60, y: 130 });
  });
});

describe('rigLayout: left side (stretch feet)', () => {
  it('keeps the feet as one block, pivoting at the split', () => {
    const layout = rigLayout(rig, 'left');
    expect(layout.mode).toBe('stretch-feet');
    expect(layout.flipX).toBe(false);
    expect(layout.split).toBe(62);
    expect(layout.feet).toEqual({ x: 0, y: 130, width: 128, height: 30 });
    expect(layout.at.feet).toEqual({ x: 0, y: 130 });
  });
});

describe('rigLayout: right side (the left image, flipped)', () => {
  const layout = rigLayout(rig, 'right');

  it('flips the images and mirrors the split to the other side', () => {
    expect(layout.flipX).toBe(true);
    expect(layout.mode).toBe('stretch-feet');
    expect(layout.split).toBe(128 - 62);
  });

  it('takes the texture regions from the opposite end, because the image is shown mirrored', () => {
    // 顯示座標 [0,66) 對應原圖的 [62,128)；顯示座標 [66,128) 對應原圖的 [0,62)。
    expect(layout.legA).toEqual({ x: 62, y: 130, width: 66, height: 30 });
    expect(layout.legB).toEqual({ x: 0, y: 130, width: 62, height: 30 });
  });

  it('puts the pieces at the mirrored positions on screen', () => {
    expect(layout.at.legA).toEqual({ x: 0, y: 130 });
    expect(layout.at.legB).toEqual({ x: 66, y: 130 });
  });

  it('uses its own split, unflipped, when right has its own image', () => {
    const own: RigDef = { ...rig, splits: { ...rig.splits, right: 66 } };
    const owned = rigLayout(own, 'right');
    expect(owned.flipX).toBe(false);
    expect(owned.split).toBe(66);
    expect(owned.legA).toEqual({ x: 0, y: 130, width: 66, height: 30 });
  });
});

describe('rigLayout: every view', () => {
  it('covers the whole lower picture with the two feet, without a gap or an overlap', () => {
    for (const view of VIEWS) {
      const { legA, legB, split, flipX } = rigLayout(rig, view);
      expect(legA.width + legB.width, view).toBe(128);
      expect(legA.height).toBe(30);
      // 在原圖上，兩塊必須首尾相接（翻轉時 B 在左、A 在右）。
      const [first, second] = flipX ? [legB, legA] : [legA, legB];
      expect(first.x).toBe(0);
      expect(first.x + first.width).toBe(second.x);
      expect(second.x + second.width).toBe(128);
      // 在螢幕上，A 在左、B 在右，分界就是 split。
      expect(rigLayout(rig, view).at.legA.x).toBe(0);
      expect(rigLayout(rig, view).at.legB.x).toBe(split);
    }
  });

  it('always draws the full-width upper body, and the upper and feet meet exactly at the leg line', () => {
    for (const view of VIEWS) {
      const { upper, legA, feet } = rigLayout(rig, view);
      expect(upper.width).toBe(128);
      expect(upper.y + upper.height).toBe(legA.y);
      expect(upper.y + upper.height).toBe(feet.y);
      expect(feet.height).toBe(legA.height);
    }
  });

  it('refuses a view that has no split to work from', () => {
    const broken = { ...rig, splits: { down: 60, up: 60 } } as unknown as RigDef;
    expect(() => rigLayout(broken, 'left')).toThrow('rig player 沒有 left 的 split');
  });
});
