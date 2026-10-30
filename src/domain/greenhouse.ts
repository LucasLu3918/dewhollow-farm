import type { Season } from './calendar';
import type { MapDef } from './content';
import { plotMapKey } from './farm';

/**
 * 溫室（M6）：溫室裡的田（地圖格子的 greenhouse 標記）不受季節限制。
 * 冬天在溫室裡可以種秋季的作物，換季時溫室裡的作物也不會枯死。溫室外的規則不變。
 * 只看季節與格子的標記，不改體力成本。
 */

/** 一張地圖上所有溫室的田，以 map-scoped crop key 表示。 */
export function greenhouseKeysOf(map: MapDef): string[] {
  const keys: string[] = [];
  map.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (map.legend[row.charAt(x)]?.greenhouse === true) keys.push(plotMapKey(map.id, x, y));
    }
  });
  return keys;
}

/** 這一格能不能種這種作物：溫室裡任何季節都能種，溫室外只能在作物的季節種。 */
export function plantableIn(cropSeasons: readonly Season[], season: Season, greenhouse: boolean): boolean {
  return greenhouse || cropSeasons.includes(season);
}

/** 換季之後，這塊田上的作物還活著嗎：溫室裡一直活著，溫室外要在新季節的名單內。 */
export function survivesSeasonChange(cropSeasons: readonly Season[], season: Season, greenhouse: boolean): boolean {
  return plantableIn(cropSeasons, season, greenhouse);
}
