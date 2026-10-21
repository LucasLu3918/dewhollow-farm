import { describe, expect, it } from 'vitest';
import { rollWeather, waters, WEATHERS, type WeatherTable } from './weather';

const TABLE: WeatherTable = {
  spring: [
    { weather: 'sunny', weight: 6 },
    { weather: 'rain', weight: 3 },
    { weather: 'wind', weight: 1 },
  ],
  summer: [{ weather: 'sunny', weight: 1 }],
  autumn: [{ weather: 'sunny', weight: 1 }],
  winter: [{ weather: 'snow', weight: 1 }],
};

describe('rollWeather', () => {
  it('only ever picks weather listed for the season', () => {
    let rng = 7;
    for (let i = 0; i < 500; i += 1) {
      const roll = rollWeather(TABLE, 'spring', rng);
      expect(['sunny', 'rain', 'wind']).toContain(roll.value);
      rng = roll.rng;
    }
  });

  it('follows the weights: sunny about 60%, rain about 30%, wind about 10%', () => {
    let rng = 12345;
    const counts: Record<string, number> = {};
    const N = 10000;
    for (let i = 0; i < N; i += 1) {
      const roll = rollWeather(TABLE, 'spring', rng);
      counts[roll.value] = (counts[roll.value] ?? 0) + 1;
      rng = roll.rng;
    }
    expect((counts.sunny ?? 0) / N).toBeGreaterThan(0.56);
    expect((counts.sunny ?? 0) / N).toBeLessThan(0.64);
    expect((counts.rain ?? 0) / N).toBeGreaterThan(0.26);
    expect((counts.rain ?? 0) / N).toBeLessThan(0.34);
  });

  it('is repeatable: the same rng gives the same weather', () => {
    expect(rollWeather(TABLE, 'spring', 999)).toEqual(rollWeather(TABLE, 'spring', 999));
  });

  it('returns a new rng state so the next roll differs', () => {
    const first = rollWeather(TABLE, 'spring', 42);
    expect(first.rng).not.toBe(42);
  });

  it('rejects a season with no weather listed', () => {
    expect(() => rollWeather({ ...TABLE, summer: [] }, 'summer', 1)).toThrow(RangeError);
  });
});

describe('waters', () => {
  it('rain and storms water the fields; sun, wind and snow do not', () => {
    expect(waters('rain')).toBe(true);
    expect(waters('storm')).toBe(true);
    expect(waters('sunny')).toBe(false);
    expect(waters('wind')).toBe(false);
    expect(waters('snow')).toBe(false);
  });

  it('knows every weather kind', () => {
    expect([...WEATHERS].sort()).toEqual(['rain', 'snow', 'storm', 'sunny', 'wind']);
  });
});
