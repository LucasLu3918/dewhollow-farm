import type { Season } from '../domain/calendar';
import type { Weather } from '../domain/weather';

/**
 * 氛圍的數值（純函式，不依賴 Phaser）：夜色、季節的草色、天氣的變暗與飄落的粒子。
 * 只負責呈現；天氣與時間本身由規則決定（domain）。
 */

/** 夜裡黑色遮罩的最大不透明度。 */
export const NIGHT_MAX_ALPHA = 0.45;

const MINUTES_PER_DAY = 24 * 60;
const DUSK_START = 18 * 60;
const DUSK_END = 20 * 60;
const DAWN_START = 4 * 60;
const DAWN_END = 6 * 60;

/** 一天中某個時刻的夜色不透明度：白天為 0，18:00 到 20:00 漸暗，04:00 到 06:00 漸亮。 */
export function nightAlpha(minuteOfDay: number): number {
  if (!(minuteOfDay >= 0 && minuteOfDay < MINUTES_PER_DAY)) {
    throw new RangeError(`分鐘必須在 0 到 1439 之間：${minuteOfDay}`);
  }
  const m = minuteOfDay;
  if (m >= DUSK_START && m < DUSK_END) return (NIGHT_MAX_ALPHA * (m - DUSK_START)) / (DUSK_END - DUSK_START);
  if (m >= DUSK_END || m < DAWN_START) return NIGHT_MAX_ALPHA;
  if (m >= DAWN_START && m < DAWN_END) return NIGHT_MAX_ALPHA * (1 - (m - DAWN_START) / (DAWN_END - DAWN_START));
  return 0;
}

/** 草地在各季節的染色（乘色）。春天不染色。 */
const GRASS_TINT: Record<Season, number> = {
  spring: 0xffffff,
  summer: 0xf2ffc8,
  autumn: 0xffd79a,
  winter: 0xd8e8f2,
};

export function seasonGrassTint(season: Season): number {
  return GRASS_TINT[season];
}

/** 天氣讓畫面變暗的程度（疊一層半透明的灰藍色）。 */
const DIM: Record<Weather, number> = {
  sunny: 0,
  wind: 0,
  rain: 0.1,
  storm: 0.2,
  snow: 0.08,
};

export function weatherDim(weather: Weather): number {
  return DIM[weather];
}

export type ParticleKind = 'streak' | 'flake' | 'leaf';

/** 天氣飄落的粒子種類；晴天沒有粒子。 */
export function particleKind(weather: Weather): ParticleKind | null {
  switch (weather) {
    case 'rain':
    case 'storm':
      return 'streak';
    case 'snow':
      return 'flake';
    case 'wind':
      return 'leaf';
    case 'sunny':
      return null;
  }
}

/** 每種粒子的下落速度（像素／毫秒）與左右飄移（像素）。 */
const MOTION: Record<ParticleKind, { fall: number; drift: number }> = {
  streak: { fall: 0.42, drift: 0 },
  flake: { fall: 0.06, drift: 14 },
  leaf: { fall: 0.1, drift: 36 },
};

/**
 * 第 i 顆粒子在時間 t（毫秒）時的位置，範圍在 [0, width) × [0, height) 之內。
 * 同一顆粒子同一時間永遠在同一處，不需要保存狀態。
 */
export function particlePosition(
  i: number,
  t: number,
  width: number,
  height: number,
  kind: ParticleKind,
): { x: number; y: number } {
  const { fall, drift } = MOTION[kind];
  const startX = ((i * 7919) % 1009) / 1009; // 0 到 1 之間，依粒子編號散開
  const startY = ((i * 6131) % 1013) / 1013;
  const x = startX * width + Math.sin((t + i * 311) / 700) * drift;
  const y = startY * height + fall * t;
  return {
    x: ((x % width) + width) % width,
    y: ((y % height) + height) % height,
  };
}
