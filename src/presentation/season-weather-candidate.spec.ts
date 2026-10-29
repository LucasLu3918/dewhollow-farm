import { describe, expect, it } from 'vitest';
import {
  SEASON_WEATHER_CANDIDATE_QUERY,
  SEASON_WEATHER_CANDIDATE_VALUE,
  seasonWeatherAmbienceFrameFor,
  seasonWeatherCandidateFramesFromManifest,
  seasonWeatherCandidateRequested,
  seasonWeatherFoliageFrameFor,
  seasonWeatherGroundFrameFor,
} from './season-weather-candidate';

describe('P6-063 season and weather candidate', () => {
  it('requires the exact DEV, Pixel32, world-v2 and task gates', () => {
    const query = new URLSearchParams(`${SEASON_WEATHER_CANDIDATE_QUERY}=${SEASON_WEATHER_CANDIDATE_VALUE}`);
    expect(seasonWeatherCandidateRequested(query, true, 'pixel32', true, true)).toBe(true);
    expect(seasonWeatherCandidateRequested(query, false, 'pixel32', true, true)).toBe(false);
    expect(seasonWeatherCandidateRequested(query, true, 'legacy', true, true)).toBe(false);
    expect(seasonWeatherCandidateRequested(query, true, 'pixel32', false, true)).toBe(false);
    expect(seasonWeatherCandidateRequested(query, true, 'pixel32', true, false)).toBe(false);
    expect(seasonWeatherCandidateRequested(new URLSearchParams(), true, 'pixel32', true, true)).toBe(false);
  });

  it('maps only farm grass to season candidates', () => {
    expect(seasonWeatherGroundFrameFor('farm', 'grass', 'spring')).toBe('season-spring');
    expect(seasonWeatherGroundFrameFor('farm', 'grass', 'winter')).toBe('season-winter');
    expect(seasonWeatherGroundFrameFor('village', 'grass', 'summer')).toBeNull();
    expect(seasonWeatherGroundFrameFor('farm', 'path', 'autumn')).toBeNull();
  });

  it('maps the existing farm tree anchor to a same-size seasonal canopy', () => {
    expect(seasonWeatherFoliageFrameFor('farm', 'autumn')).toBe('season-autumn-foliage');
    expect(seasonWeatherFoliageFrameFor('village', 'winter')).toBeNull();
  });

  it('selects four repeatable lighting and weather states from existing time/weather inputs', () => {
    expect(seasonWeatherAmbienceFrameFor(5 * 60, 'sunny')).toBe('ambience-dawn');
    expect(seasonWeatherAmbienceFrameFor(12 * 60, 'sunny')).toBe('ambience-day');
    expect(seasonWeatherAmbienceFrameFor(19 * 60, 'sunny')).toBe('ambience-dusk');
    expect(seasonWeatherAmbienceFrameFor(22 * 60, 'rain')).toBe('ambience-rain-night');
    expect(seasonWeatherAmbienceFrameFor(22 * 60, 'sunny')).toBe('ambience-day');
  });

  it('accepts only the unapproved atlas contract with all required frames', () => {
    const ids = [
      'season-spring', 'season-summer', 'season-autumn', 'season-winter',
      'season-spring-foliage', 'season-summer-foliage', 'season-autumn-foliage', 'season-winter-foliage',
      'ambience-dawn', 'ambience-day', 'ambience-dusk', 'ambience-rain-night',
    ];
    const manifest = {
      status: 'candidate', approved: false,
      pixelContract: { nativeTileSize: 32, displayScale: 2 },
      atlas: { file: 'atlas.png', width: 384, height: 128 },
      frames: Object.fromEntries(ids.map((id, index) => {
        const foliage = id.endsWith('-foliage');
        const overlay = id.startsWith('ambience-');
        const groupIndex = foliage ? index - 4 : overlay ? index - 8 : index;
        return [id, {
          x: foliage ? groupIndex * 96 : overlay ? (groupIndex + 8) * 32 : groupIndex * 32,
          y: foliage ? 0 : overlay ? 96 : 96,
          width: foliage ? 96 : 32,
          height: foliage ? 96 : 32,
          approved: false,
        }];
      })),
    };
    expect(seasonWeatherCandidateFramesFromManifest(manifest)).not.toBeNull();
    expect(seasonWeatherCandidateFramesFromManifest({ ...manifest, approved: true })).toBeNull();
    expect(seasonWeatherCandidateFramesFromManifest({ ...manifest, frames: {} })).toBeNull();
  });
});
