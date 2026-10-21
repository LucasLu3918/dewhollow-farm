import type { Season } from '../domain/calendar';
import type { Weather } from '../domain/weather';

/**
 * 腳步用的地面判斷（純函式，不依賴 Phaser）：水邊與雪地會蓋過格子本身的地面。
 * 只決定「用哪一筆腳步設定」（content/terrain.json）；可不可以走、天氣與季節的規則都在 domain。
 */

/** 水邊的腳步設定在 content/terrain.json 的 kind。 */
export const SHORE_KIND = 'shore';
/** 雪地的腳步設定在 content/terrain.json 的 kind。 */
export const SNOW_KIND = 'snow';

/** 只要有一側是水，就算水邊（湖的岸邊格）。 */
export function touchesWater(neighborKinds: readonly (string | undefined)[]): boolean {
  return neighborKinds.includes('water');
}

/** 下雪，或冬天（冬天在戶外一律當作雪地）。 */
export function isSnowy(weather: Weather, season: Season): boolean {
  return weather === 'snow' || season === 'winter';
}

export interface FootstepEnv {
  touchesWater: boolean;
  weather: Weather;
  season: Season;
}

/**
 * 離開一格時該用哪一種腳步。優先序：戶外水邊 > 戶外雪地 > 格子本身的地面。
 * 室內（outdoor 為 false）永遠用格子本身的地面。
 */
export function footstepKind(ground: { kind: string; outdoor: boolean }, env: FootstepEnv): string {
  if (ground.outdoor && env.touchesWater) return SHORE_KIND;
  if (ground.outdoor && isSnowy(env.weather, env.season)) return SNOW_KIND;
  return ground.kind;
}
