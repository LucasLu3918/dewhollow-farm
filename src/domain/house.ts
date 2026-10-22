/**
 * 小屋擴建（金幣出口）。小屋有三種格局：基本的 house、擴建第一次的 house-wing（東側加一間房）、
 * 擴建第二次的 house-full（再加廚房與工作台）。擴建的進度存在旗標裡（house-wing、house-full），
 * 通往小屋的門依旗標落到對應的地圖（見 game-commands.ts 的 enter）。擴建只買一次，第二次要先有第一次。
 */

export const HOUSE_MAP_ID = 'house';
export const HOUSE_WING_MAP_ID = 'house-wing';
export const HOUSE_FULL_MAP_ID = 'house-full';

/** 擴建的旗標（同時是店家賣的 building.<旗標> 的名字，見 shops.json）。 */
export const HOUSE_WING_FLAG = 'house-wing';
export const HOUSE_FULL_FLAG = 'house-full';

/** 目前的小屋地圖：依擴建旗標決定（第二次擴建的旗標優先）。 */
export function houseMapIdFor(flags: Readonly<Record<string, boolean>>): string {
  if (flags[HOUSE_FULL_FLAG]) return HOUSE_FULL_MAP_ID;
  if (flags[HOUSE_WING_FLAG]) return HOUSE_WING_MAP_ID;
  return HOUSE_MAP_ID;
}

/** 門的目的地：通往「小屋」的門落到目前的擴建格局；其他目的地不變。 */
export function resolveDestination(mapId: string, flags: Readonly<Record<string, boolean>>): string {
  return mapId === HOUSE_MAP_ID ? houseMapIdFor(flags) : mapId;
}

/**
 * 能不能買這次擴建：已經買過就不能再買；第二次擴建要先有第一次。
 * 回傳不能買的原因代碼（null 表示可以買）。
 */
export function expansionRefusal(flags: Readonly<Record<string, boolean>>, flag: string): 'ALREADY_OWNED' | 'NEED_HOUSE_WING' | null {
  if (flags[flag]) return 'ALREADY_OWNED';
  if (flag === HOUSE_FULL_FLAG && !flags[HOUSE_WING_FLAG]) return 'NEED_HOUSE_WING';
  return null;
}
