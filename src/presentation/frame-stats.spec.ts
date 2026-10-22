import { describe, expect, it } from 'vitest';
import { MAX_FRAME_GAP_MS, parsePerfFlag, summarizeFrameWindow, summarizeFrames } from './frame-stats';

describe('parsePerfFlag', () => {
  it('turns the overlay on only for ?perf=1', () => {
    expect(parsePerfFlag('?perf=1')).toBe(true);
    expect(parsePerfFlag('?slot=2&perf=1')).toBe(true);
    expect(parsePerfFlag('?perf=0')).toBe(false);
    expect(parsePerfFlag('?perf=yes')).toBe(false);
    expect(parsePerfFlag('')).toBe(false);
  });
});

describe('summarizeFrames', () => {
  it('returns null when there is nothing to measure yet', () => {
    expect(summarizeFrames([])).toBeNull();
  });

  it('reports about 60 fps for steady 16.7 ms frames', () => {
    const stats = summarizeFrames(Array.from({ length: 10 }, () => 16.7));
    expect(stats).not.toBeNull();
    expect(stats?.frames).toBe(10);
    expect(stats?.fps).toBeCloseTo(59.9, 1);
    expect(stats?.p50).toBe(16.7);
    expect(stats?.p95).toBe(16.7);
    expect(stats?.slowFrames).toBe(0);
  });

  it('counts frames slower than about two 60 Hz frames as slow, and keeps the worst one', () => {
    const deltas = [...Array.from({ length: 19 }, () => 16.7), 50];
    const stats = summarizeFrames(deltas);
    expect(stats?.slowFrames).toBe(1);
    expect(stats?.worst).toBe(50);
  });

  it('ignores background gaps (tab switched away) instead of letting them skew the average', () => {
    const stats = summarizeFrames([16.7, 16.7, MAX_FRAME_GAP_MS + 5000]);
    expect(stats?.frames).toBe(2);
    expect(stats?.fps).toBeCloseTo(59.9, 1);
  });

  it('puts the 95th percentile above the median when a few frames are long', () => {
    const deltas = [...Array.from({ length: 90 }, () => 16), ...Array.from({ length: 10 }, () => 40)];
    const stats = summarizeFrames(deltas);
    expect(stats?.p50).toBe(16);
    expect(stats?.p95).toBe(40);
  });
});

describe('summarizeFrameWindow', () => {
  it('waits until a full active-time window has elapsed', () => {
    expect(summarizeFrameWindow([{ elapsedMs: 1_000, deltaMs: 16 }], 29_999, 30_000)).toBeNull();
  });

  it('summarizes only the trailing complete window and ignores samples at its boundary', () => {
    const stats = summarizeFrameWindow([
      { elapsedMs: 5_000, deltaMs: 80 },
      { elapsedMs: 10_000, deltaMs: 16 },
      { elapsedMs: 25_000, deltaMs: 16 },
      { elapsedMs: 40_000, deltaMs: 40 },
    ], 40_000, 30_000);
    expect(stats?.frames).toBe(2);
    expect(stats?.p50).toBe(16);
    expect(stats?.p95).toBe(40);
    expect(stats?.slowFrames).toBe(1);
  });

  it('returns null for an empty completed interval', () => {
    expect(summarizeFrameWindow([], 30_000, 30_000)).toBeNull();
  });
});
