import { describe, expect, it } from 'vitest';
import { SEASONS } from '../domain/calendar';
import { WEATHERS } from '../domain/weather';
import { nightAlpha, particleKind, particlePosition, seasonGrassTint, weatherDim, NIGHT_MAX_ALPHA } from './atmosphere';

const MINUTES_PER_DAY = 24 * 60;
const at = (hour: number) => hour * 60;

describe('nightAlpha (day and night tint)', () => {
  it('is clear through the day, from wake-up to dusk', () => {
    for (const hour of [6, 9, 12, 15, 17]) expect(nightAlpha(at(hour)), `${hour}:00`).toBe(0);
  });

  it('is at full night strength at midnight and in the small hours', () => {
    expect(nightAlpha(0)).toBe(NIGHT_MAX_ALPHA);
    expect(nightAlpha(at(2))).toBe(NIGHT_MAX_ALPHA);
    expect(nightAlpha(at(20))).toBe(NIGHT_MAX_ALPHA);
  });

  it('darkens smoothly from 18:00 to 20:00', () => {
    expect(nightAlpha(at(18))).toBe(0);
    expect(nightAlpha(at(19))).toBeCloseTo(NIGHT_MAX_ALPHA / 2, 10);
    expect(nightAlpha(at(20))).toBe(NIGHT_MAX_ALPHA);
  });

  it('brightens smoothly from 04:00 to 06:00', () => {
    expect(nightAlpha(at(4))).toBe(NIGHT_MAX_ALPHA);
    expect(nightAlpha(at(5))).toBeCloseTo(NIGHT_MAX_ALPHA / 2, 10);
    expect(nightAlpha(at(6))).toBe(0);
  });

  it('never jumps across midnight: 23:59 and 00:00 are both night', () => {
    expect(Math.abs(nightAlpha(MINUTES_PER_DAY - 1) - nightAlpha(0))).toBeLessThan(0.01);
  });

  it('stays between 0 and the maximum for every minute of the day', () => {
    for (let m = 0; m < MINUTES_PER_DAY; m += 1) {
      const a = nightAlpha(m);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(NIGHT_MAX_ALPHA);
    }
  });

  it('rejects a minute outside the day', () => {
    expect(() => nightAlpha(-1)).toThrow(RangeError);
    expect(() => nightAlpha(MINUTES_PER_DAY)).toThrow(RangeError);
  });
});

describe('seasonGrassTint', () => {
  it('spring is untinted, and every season is a valid colour', () => {
    expect(seasonGrassTint('spring')).toBe(0xffffff);
    for (const season of SEASONS) {
      const tint = seasonGrassTint(season);
      expect(Number.isInteger(tint)).toBe(true);
      expect(tint).toBeGreaterThanOrEqual(0);
      expect(tint).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('gives each season its own colour', () => {
    const tints = SEASONS.map(seasonGrassTint);
    expect(new Set(tints).size).toBe(SEASONS.length);
  });
});

describe('weatherDim', () => {
  it('is clear in sunshine and wind, dim in rain and snow, darkest in a storm', () => {
    expect(weatherDim('sunny')).toBe(0);
    expect(weatherDim('wind')).toBe(0);
    expect(weatherDim('rain')).toBeGreaterThan(0);
    expect(weatherDim('storm')).toBeGreaterThan(weatherDim('rain'));
    expect(weatherDim('snow')).toBeGreaterThan(0);
  });

  it('covers every weather', () => {
    for (const weather of WEATHERS) expect(weatherDim(weather)).toBeGreaterThanOrEqual(0);
  });
});

describe('particleKind', () => {
  it('rain and storms fall as streaks, snow as flakes, wind as leaves, sunshine has none', () => {
    expect(particleKind('rain')).toBe('streak');
    expect(particleKind('storm')).toBe('streak');
    expect(particleKind('snow')).toBe('flake');
    expect(particleKind('wind')).toBe('leaf');
    expect(particleKind('sunny')).toBeNull();
  });
});

describe('particlePosition', () => {
  const W = 320;
  const H = 240;

  it('always stays inside the view, for any particle and any time', () => {
    for (const kind of ['streak', 'flake', 'leaf'] as const) {
      for (let i = 0; i < 60; i += 1) {
        for (let t = 0; t < 5000; t += 137) {
          const p = particlePosition(i, t, W, H, kind);
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThan(W);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThan(H);
          expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        }
      }
    }
  });

  it('falls downward over time, a little at a time (wrapping at the bottom)', () => {
    for (const kind of ['streak', 'flake'] as const) {
      const a = particlePosition(3, 1000, W, H, kind);
      const b = particlePosition(3, 1100, W, H, kind);
      const dy = (((b.y - a.y) % H) + H) % H;
      expect(dy, kind).toBeGreaterThan(0);
      expect(dy, kind).toBeLessThan(H / 2);
    }
  });

  it('is repeatable: the same particle at the same time is in the same place', () => {
    expect(particlePosition(7, 4321, W, H, 'flake')).toEqual(particlePosition(7, 4321, W, H, 'flake'));
  });

  it('spreads particles out: no two of the first ten share a spot', () => {
    const spots = new Set<string>();
    for (let i = 0; i < 10; i += 1) {
      const p = particlePosition(i, 0, W, H, 'streak');
      spots.add(`${Math.round(p.x)},${Math.round(p.y)}`);
    }
    expect(spots.size).toBe(10);
  });
});
