import { describe, expect, it } from 'vitest';
import { mineStatusLabel } from './mine-status';

describe('mine status label (HUD)', () => {
  it('outside the mine, shows the floor the elevator can reach, or that the elevator is not open yet', () => {
    expect(mineStatusLabel({ mapId: 'farm', mineCheckpoint: 1 })).toBe('礦坑：電梯尚未開通（走到第 5 層會設下檢查點）');
    expect(mineStatusLabel({ mapId: 'mine-entrance', mineCheckpoint: 45 })).toBe('礦坑：電梯可到第 45 層');
  });

  it('inside the mine, shows the current floor together with the elevator floor', () => {
    expect(mineStatusLabel({ mapId: 'mine-46', mineCheckpoint: 45 })).toBe('礦坑第 46 層｜電梯可到第 45 層');
    expect(mineStatusLabel({ mapId: 'mine-2', mineCheckpoint: 1 })).toBe('礦坑第 2 層｜電梯尚未開通（走到第 5 層會設下檢查點）');
  });
});
