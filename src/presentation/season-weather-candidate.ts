import type { Season } from '../domain/calendar';
import type { Weather } from '../domain/weather';
import { nightAlpha } from './atmosphere';
import { worldV2CandidateFramesFromManifest } from './world-v2-scene-candidate';

export const SEASON_WEATHER_CANDIDATE_QUERY = 'gate1SeasonWeather';
export const SEASON_WEATHER_CANDIDATE_VALUE = 'p6-063';
export const SEASON_WEATHER_CANDIDATE_MANIFEST_KEY = 'gate1-p6-063-season-weather-manifest';
export const SEASON_WEATHER_CANDIDATE_ATLAS_KEY = 'gate1-p6-063-season-weather-atlas';

export const SEASON_WEATHER_REQUIRED_FRAMES = [
  'season-spring', 'season-summer', 'season-autumn', 'season-winter',
  'season-spring-foliage', 'season-summer-foliage', 'season-autumn-foliage', 'season-winter-foliage',
  'ambience-dawn', 'ambience-day', 'ambience-dusk', 'ambience-rain-night',
] as const;

export function seasonWeatherCandidateRequested(
  search: URLSearchParams,
  isDev: boolean,
  renderProfile: string,
  pixel32RuntimeEnabled: boolean,
  worldV2SceneEnabled: boolean,
): boolean {
  return isDev
    && renderProfile === 'pixel32'
    && pixel32RuntimeEnabled
    && worldV2SceneEnabled
    && search.get(SEASON_WEATHER_CANDIDATE_QUERY) === SEASON_WEATHER_CANDIDATE_VALUE;
}

export function seasonWeatherCandidateFramesFromManifest(value: unknown): Record<string, { x: number; y: number; width: number; height: number; approved?: boolean }> | null {
  return worldV2CandidateFramesFromManifest(value, 'atlas.png', SEASON_WEATHER_REQUIRED_FRAMES);
}

export function seasonWeatherGroundFrameFor(
  mapId: string,
  groundKind: string,
  season: Season,
): string | null {
  return mapId === 'farm' && groundKind === 'grass' ? `season-${season}` : null;
}

export function seasonWeatherFoliageFrameFor(mapId: string, season: Season): string | null {
  return mapId === 'farm' ? `season-${season}-foliage` : null;
}

export function seasonWeatherAmbienceFrameFor(minuteOfDay: number, weather: Weather): string {
  if (minuteOfDay >= 4 * 60 && minuteOfDay < 6 * 60) return 'ambience-dawn';
  if (minuteOfDay >= 18 * 60 && minuteOfDay < 20 * 60) return 'ambience-dusk';
  if (nightAlpha(minuteOfDay) > 0 && (weather === 'rain' || weather === 'storm')) return 'ambience-rain-night';
  return 'ambience-day';
}
