import { describe, expect, it } from 'vitest';
import { passDays, startJob, takeReady, type ProcessingJob } from './processing';

describe('processing machine (加工機)', () => {
  it('adds a job that needs the recipe days to finish', () => {
    const started = startJob([], 'pickle-bean', 2, 3);
    expect(started).toEqual({ ok: true, value: [{ recipeId: 'pickle-bean', daysLeft: 2 }] });
  });

  it('refuses a new job when every slot is busy, and keeps the old jobs', () => {
    const busy: ProcessingJob[] = [
      { recipeId: 'dried-mint', daysLeft: 1 },
      { recipeId: 'dried-carp', daysLeft: 0 },
    ];
    expect(startJob(busy, 'pickle-bean', 1, 2)).toEqual({ ok: false, reason: 'MACHINE_FULL' });
    expect(busy).toHaveLength(2);
  });

  it('counts down one day at a time and never below zero', () => {
    const jobs: ProcessingJob[] = [
      { recipeId: 'pickle-radish', daysLeft: 2 },
      { recipeId: 'dried-mint', daysLeft: 1 },
    ];
    const once = passDays(jobs);
    expect(once.map((j) => j.daysLeft)).toEqual([1, 0]);
    const twice = passDays(once);
    expect(twice.map((j) => j.daysLeft)).toEqual([0, 0]);
  });

  it('separates finished jobs from the ones still cooking, keeping order', () => {
    const jobs: ProcessingJob[] = [
      { recipeId: 'a', daysLeft: 0 },
      { recipeId: 'b', daysLeft: 1 },
      { recipeId: 'c', daysLeft: 0 },
    ];
    const { ready, remaining } = takeReady(jobs);
    expect(ready.map((j) => j.recipeId)).toEqual(['a', 'c']);
    expect(remaining.map((j) => j.recipeId)).toEqual(['b']);
  });
});
