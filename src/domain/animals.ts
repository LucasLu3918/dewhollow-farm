import type { Quality } from './items';

/**
 * 畜牧：雞舍的雞與牛舍的牛。每天餵飽（乾草）、摸摸（互動）、睡醒時照顧結算。
 * 雞睡醒時下蛋（餵飽的雞各一顆）；牛要人去擠奶（需已餵飽，每天一次）。
 * 心情 0 到 10：摸過加一，沒餵飽減一；心情 5 以上的動物有機會出優良的產物，9 以上有機會出精良的牛奶。
 */

/** 動物住在哪一種建築：雞舍（animals）或牛舍（cows）。地圖上的 flock 欄位指定，見 content/maps。 */
export type FlockId = 'animals' | 'cows';

export interface Animal {
  kind: string;
  fed: boolean;
  petted: boolean;
  /** 今天已經擠過奶（只有牛會用到；雞的這個欄位一直是 false）。 */
  milked: boolean;
  mood: number;
}

/** 擠奶的設定：奶的物品，以及心情夠高時出優良與精良奶的機率（0 到 1，精良的機率不大於優良）。 */
export interface MilkDef {
  item: string;
  goodChance: number;
  fineChance: number;
}

export interface AnimalDef {
  id: string;
  name: string;
  /** 下蛋的動物：下的蛋是哪一種物品，與優良蛋的機率（0 到 1）。 */
  eggItem?: string;
  eggQuality?: number;
  /** 產奶的動物：每天要擠一次（見 milkQuality）。 */
  milk?: MilkDef;
}

export const MOOD_MIN = 0;
export const MOOD_MAX = 10;
/** 心情達到這個值，才有機會下優良蛋或出優良奶。 */
export const HAPPY_FROM = 5;
/** 心情達到這個值，牛奶才有機會是精良的。 */
export const FINE_FROM = 9;

const clampMood = (mood: number): number => Math.max(MOOD_MIN, Math.min(MOOD_MAX, mood));

export function newAnimal(kind: string): Animal {
  return { kind, fed: false, petted: false, milked: false, mood: 5 };
}

export function feedAll(flock: readonly Animal[]): Animal[] {
  return flock.map((animal) => ({ ...animal, fed: true }));
}

/** 摸第 slot 隻動物（位置不存在就什麼都不做）。 */
export function petAnimal(flock: readonly Animal[], slot: number): Animal[] {
  if (slot < 0 || slot >= flock.length) return [...flock];
  return flock.map((animal, i) => (i === slot ? { ...animal, petted: true, mood: clampMood(animal.mood + 1) } : animal));
}

/** 下蛋的設定（雞）：只取需要的欄位，讓測試與呼叫端不必帶整份動物定義。 */
export interface EggDef {
  eggItem: string;
  eggQuality: number;
}

/**
 * 睡醒前的產蛋：餵飽的動物各下一顆蛋。r 是 0 到 1 的隨機數（同一天的所有蛋共用，
 * 讓結果只由狀態決定）；心情夠高且 r 小於 eggQuality 才是優良蛋。
 */
export function produceEggs(
  flock: readonly Animal[],
  def: EggDef,
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

/**
 * 擠奶的品質：心情 9 以上且 r 小於 fineChance 是精良；心情 5 以上且 r 小於 goodChance 是優良；其餘是普通。
 * 心情越高，出好奶的機會越大（與雞蛋相同，用同一個隨機數判斷）。
 */
export function milkQuality(mood: number, r: number, milk: MilkDef): Quality {
  if (mood >= FINE_FROM && r < milk.fineChance) return 'fine';
  if (mood >= HAPPY_FROM && r < milk.goodChance) return 'good';
  return 'normal';
}

/** 睡醒時的照顧結算：摸過的加一點心情，沒餵飽的減一點；餵飽、摸過與擠奶的紀錄當天重置。 */
export function dailyCare(flock: readonly Animal[]): Animal[] {
  return flock.map((animal) => {
    const delta = animal.petted ? 1 : animal.fed ? 0 : -1;
    return { ...animal, fed: false, petted: false, milked: false, mood: clampMood(animal.mood + delta) };
  });
}

/** 座位：地圖上標了 slot 的格子，依列由上到下、由左到右排序。第 i 隻動物坐第 i 個座位。 */
export function slotsOf(map: { rows: string[]; legend: Record<string, { slot?: boolean }> }): { x: number; y: number }[] {
  const seats: { x: number; y: number }[] = [];
  map.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (map.legend[row[x] ?? '']?.slot) seats.push({ x, y });
    }
  });
  return seats;
}
