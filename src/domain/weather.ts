import type { Season } from './calendar';
import { rollInt } from './random';

/** 天氣：晴、雨、風、暴風雨、雪。雨與暴風雨會替田地澆水。 */
export const WEATHERS = ['sunny', 'rain', 'wind', 'storm', 'snow'] as const;
export type Weather = (typeof WEATHERS)[number];

export interface WeatherChance {
  weather: Weather;
  /** 相對權重，必須是正整數。 */
  weight: number;
}

/** 每個季節可能出現的天氣與權重（來自 content/weather.json）。 */
export type WeatherTable = Record<Season, WeatherChance[]>;

export const WEATHER_NAMES: Record<Weather, string> = {
  sunny: '晴',
  rain: '雨',
  wind: '風',
  storm: '暴風雨',
  snow: '雪',
};

const WATERING: ReadonlySet<Weather> = new Set<Weather>(['rain', 'storm']);

export function waters(weather: Weather): boolean {
  return WATERING.has(weather);
}

/** 依權重抽一種天氣；同一個 rng 狀態永遠得到同一個結果。 */
export function rollWeather(table: WeatherTable, season: Season, rng: number): { value: Weather; rng: number } {
  const chances = table[season];
  const total = chances.reduce((sum, chance) => sum + chance.weight, 0);
  if (chances.length === 0 || total <= 0) throw new RangeError(`${season} 沒有可能的天氣`);
  const roll = rollInt(rng, 1, total);
  let remaining = roll.value;
  for (const chance of chances) {
    remaining -= chance.weight;
    if (remaining <= 0) return { value: chance.weather, rng: roll.rng };
  }
  // 不會走到這裡（權重總和與抽到的數字一致），保險起見回傳最後一種。
  return { value: chances[chances.length - 1]?.weather ?? 'sunny', rng: roll.rng };
}
