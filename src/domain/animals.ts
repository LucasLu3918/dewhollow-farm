import type { Quality } from './items';

/**
 * 畜牧：雞舍裡的動物。每天餵飽（乾草）、摸摸（互動）、睡醒時下蛋。
 * 心情 0 到 10：摸過加一，沒餵飽減一；心情 5 以上的動物有機會下優良的蛋。
 */

export interface Animal {
  kind: string;
  fed: boolean;
  petted: boolean;
  mood: number;
}

export interface AnimalDef {
  id: string;
  name: string;
  /** 下的蛋是哪一種物品。 */
  eggItem: string;
  /** 心情 5 以上時，下優良蛋的機率（0 到 1）。 */
  eggQuality: number;
}

export const MOOD_MIN = 0;
export const MOOD_MAX = 10;
/** 心情達到這個值，才有機會下優良蛋。 */
export const HAPPY_FROM = 5;

const clampMood = (mood: number): number => Math.max(MOOD_MIN, Math.min(MOOD_MAX, mood));

export function newAnimal(kind: string): Animal {
  return { kind, fed: false, petted: false, mood: 5 };
}

export function feedAll(flock: readonly Animal[]): Animal[] {
  return flock.map((animal) => ({ ...animal, fed: true }));
}

/** 摸第 slot 隻動物（位置不存在就什麼都不做）。 */
export function petAnimal(flock: readonly Animal[], slot: number): Animal[] {
  if (slot < 0 || slot >= flock.length) return [...flock];
  return flock.map((animal, i) => (i === slot ? { ...animal, petted: true, mood: clampMood(animal.mood + 1) } : animal));
}

/**
 * 睡醒前的產蛋：餵飽的動物各下一顆蛋。r 是 0 到 1 的隨機數（同一天的所有蛋共用，
 * 讓結果只由狀態決定）；心情夠高且 r 小於 eggQuality 才是優良蛋。
 */
export function produceEggs(
  flock: readonly Animal[],
  def: AnimalDef,
  r: number,
): { eggs: { itemId: string; quality: Quality }[] } {
  const luckyDay = r < def.eggQuality;
  const eggs = flock
    .filter((animal) => animal.fed)
    .map((animal) => ({
      itemId: def.eggItem,
      quality: (luckyDay && animal.mood >= HAPPY_FROM ? 'good' : 'normal') as Quality,
    }));
  return { eggs };
}

/** 睡醒時的照顧結算：摸過的加一點心情，沒餵飽的減一點；餵飽與摸過的紀錄當天重置。 */
export function dailyCare(flock: readonly Animal[]): Animal[] {
  return flock.map((animal) => {
    const delta = animal.petted ? 1 : animal.fed ? 0 : -1;
    return { ...animal, fed: false, petted: false, mood: clampMood(animal.mood + delta) };
  });
}

/** 雞舍裡的座位：地圖上標了 slot 的格子，依列由上到下、由左到右排序。第 i 隻動物坐第 i 個座位。 */
export function slotsOf(map: { rows: string[]; legend: Record<string, { slot?: boolean }> }): { x: number; y: number }[] {
  const seats: { x: number; y: number }[] = [];
  map.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (map.legend[row[x] ?? '']?.slot) seats.push({ x, y });
    }
  });
  return seats;
}
