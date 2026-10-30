import { describe, expect, it } from 'vitest';
import type { MapDef, TileDef } from './content';
import { greenhouseKeysOf, plantableIn, survivesSeasonChange } from './greenhouse';

const legend: Record<string, TileDef> = {
  '#': { kind: 'fence' },
  '.': { kind: 'grass' },
  f: { kind: 'field' },
  g: { kind: 'field', greenhouse: true },
};

const map: MapDef = {
  id: 'test',
  name: '測試',
  width: 4,
  height: 2,
  rows: ['#gg.', 'fg#.'],
  legend,
  spawn: { x: 3, y: 1 },
};

describe('溫室的田（domain/greenhouse.ts）', () => {
  it('finds the greenhouse cells on a map by their tiles, not by their position', () => {
    expect(greenhouseKeysOf(map)).toEqual(['test|1,0', 'test|2,0', 'test|1,1']);
  });

  it('a field outside the greenhouse takes only the seasons its crop allows', () => {
    expect(plantableIn(['autumn'], 'winter', false)).toBe(false);
    expect(plantableIn(['autumn'], 'autumn', false)).toBe(true);
    expect(plantableIn(['winter'], 'winter', false)).toBe(true);
  });

  it('a greenhouse plot can take any crop in any season, the winter included', () => {
    expect(plantableIn(['spring', 'summer'], 'winter', true)).toBe(true);
    expect(plantableIn(['autumn'], 'winter', true)).toBe(true);
  });

  it('a crop out of season dies at the change of season outside, and lives inside the greenhouse', () => {
    expect(survivesSeasonChange(['autumn'], 'winter', false)).toBe(false);
    expect(survivesSeasonChange(['autumn'], 'winter', true)).toBe(true);
    expect(survivesSeasonChange(['winter'], 'winter', false)).toBe(true);
  });
});
