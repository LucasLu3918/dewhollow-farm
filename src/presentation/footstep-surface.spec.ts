import { describe, expect, it } from 'vitest';
import terrain from '../../content/terrain.json';
import { footstepKind, isSnowy, SHORE_KIND, SNOW_KIND, touchesWater, type FootstepEnv } from './footstep-surface';

const GRASS = { kind: 'grass', outdoor: true };
const PATH = { kind: 'path', outdoor: true };
const FLOOR = { kind: 'floor', outdoor: false };

const SUMMER_DRY: FootstepEnv = { touchesWater: false, weather: 'sunny', season: 'summer' };

describe('touchesWater', () => {
  it('is true when any side of the tile is water', () => {
    expect(touchesWater(['grass', 'water', 'grass', 'path'])).toBe(true);
  });

  it('is false on dry land, and ignores the missing neighbours at the map edge', () => {
    expect(touchesWater(['grass', 'wall', undefined, 'field'])).toBe(false);
    expect(touchesWater([undefined, undefined])).toBe(false);
  });
});

describe('isSnowy', () => {
  it('is snowy when it snows, or in winter whatever the weather', () => {
    expect(isSnowy('snow', 'spring')).toBe(true);
    expect(isSnowy('sunny', 'winter')).toBe(true);
  });

  it('is not snowy in the other seasons without snow', () => {
    expect(isSnowy('sunny', 'summer')).toBe(false);
    expect(isSnowy('storm', 'autumn')).toBe(false);
    expect(isSnowy('wind', 'spring')).toBe(false);
  });
});

describe('footstepKind', () => {
  it('keeps the ground itself on dry land in good weather', () => {
    expect(footstepKind(GRASS, SUMMER_DRY)).toBe('grass');
    expect(footstepKind(PATH, SUMMER_DRY)).toBe('path');
  });

  it('uses the wet shore footstep outdoors beside the water, whatever the weather', () => {
    expect(footstepKind(GRASS, { ...SUMMER_DRY, touchesWater: true })).toBe(SHORE_KIND);
    expect(footstepKind(PATH, { touchesWater: true, weather: 'snow', season: 'winter' })).toBe(SHORE_KIND);
  });

  it('uses the snow footstep outdoors when it snows or in winter', () => {
    expect(footstepKind(GRASS, { touchesWater: false, weather: 'snow', season: 'spring' })).toBe(SNOW_KIND);
    expect(footstepKind({ kind: 'field', outdoor: true }, { touchesWater: false, weather: 'sunny', season: 'winter' })).toBe(SNOW_KIND);
  });

  it('never uses the outdoor footsteps indoors, even beside water or in snow', () => {
    expect(footstepKind(FLOOR, { touchesWater: false, weather: 'snow', season: 'winter' })).toBe('floor');
    expect(footstepKind(FLOOR, { touchesWater: true, weather: 'rain', season: 'spring' })).toBe('floor');
  });

  it('gives the shore priority over snow', () => {
    expect(footstepKind(GRASS, { touchesWater: true, weather: 'snow', season: 'winter' })).toBe(SHORE_KIND);
  });
});

describe('terrain content for the shore and snow', () => {
  it('defines an outdoor footstep with its own sound for the shore and for snow', () => {
    const shore = terrain.terrains.find((t) => t.kind === SHORE_KIND);
    const snow = terrain.terrains.find((t) => t.kind === SNOW_KIND);
    expect(shore).toBeDefined();
    expect(snow).toBeDefined();
    expect(shore?.outdoor).toBe(true);
    expect(snow?.outdoor).toBe(true);
    expect(shore?.footstep.sound).toBe('step.splash');
    expect(snow?.footstep.sound).toBe('step.snow');
  });
});
