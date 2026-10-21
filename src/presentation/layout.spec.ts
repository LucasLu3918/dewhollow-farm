import { describe, expect, it } from 'vitest';
import { centerOf, footOf, standOf } from './layout';

describe('layout (64 px tiles)', () => {
  it('puts a standing sprite on the bottom-left corner of its tile', () => {
    // 角色圖比格子高時往上長，腳底仍貼齊格子底部。
    expect(footOf(7, 9)).toEqual({ x: 448, y: 640 });
    expect(footOf(0, 0)).toEqual({ x: 0, y: 64 });
  });

  it('stands a character on the middle of the bottom edge of its tile (the pivot of a rig)', () => {
    expect(standOf(7, 9)).toEqual({ x: 480, y: 640 });
    expect(standOf(0, 0)).toEqual({ x: 32, y: 64 });
  });

  it('finds the middle of a tile, which is where the camera looks', () => {
    expect(centerOf(7, 9)).toEqual({ x: 480, y: 608 });
  });
});
