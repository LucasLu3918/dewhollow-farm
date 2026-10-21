import { fail, ok, type Result } from './result';

export interface Bag {
  /** 種子數量，鍵為作物 id。 */
  seeds: Record<string, number>;
  /** 收成的作物數量，鍵為作物 id。 */
  crops: Record<string, number>;
}

export function createBag(): Bag {
  return { seeds: {}, crops: {} };
}

export function addSeeds(bag: Bag, cropId: string, count: number): Bag {
  return { ...bag, seeds: { ...bag.seeds, [cropId]: (bag.seeds[cropId] ?? 0) + count } };
}

export function addCrop(bag: Bag, cropId: string, count: number): Bag {
  return { ...bag, crops: { ...bag.crops, [cropId]: (bag.crops[cropId] ?? 0) + count } };
}

export function removeSeed(bag: Bag, cropId: string): Result<Bag, 'NO_SEED'> {
  const count = bag.seeds[cropId] ?? 0;
  if (count <= 0) return fail('NO_SEED');
  const seeds = { ...bag.seeds };
  if (count === 1) delete seeds[cropId];
  else seeds[cropId] = count - 1;
  return ok({ ...bag, seeds });
}

export function takeAllCrops(bag: Bag): { bag: Bag; crops: Record<string, number> } {
  return { bag: { ...bag, crops: {} }, crops: { ...bag.crops } };
}
