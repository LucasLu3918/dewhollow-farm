import { describe, expect, it } from 'vitest';
import { dailyCare, feedAll, growWool, milkQuality, newAnimal, petAnimal, produceEggs, productQuality, shearAt, woolReady, type Animal } from './animals';

const CHICKEN = { id: 'chicken', name: '雞', eggItem: 'egg', eggQuality: 0.3 };
const MILK = { item: 'milk', goodChance: 0.3, fineChance: 0.1 };
const WOOL = { item: 'wool', everyDays: 3, goodChance: 0.3, fineChance: 0.1 };

/** 一隻已經餵過、摸過的羊，羊毛長了幾天。 */
function sheep(woolDays: number, extra: Partial<Animal> = {}): Animal {
  return { ...newAnimal('sheep'), woolDays, ...extra };
}

describe('animal care', () => {
  it('a new animal is hungry, not yet petted or milked, with a neutral mood', () => {
    expect(newAnimal('chicken')).toEqual({ kind: 'chicken', fed: false, petted: false, milked: false, mood: 5 });
  });

  it('feeding fills every animal, and petting raises the mood by one, up to 10', () => {
    const flock: Animal[] = [newAnimal('chicken'), newAnimal('chicken')];
    const fed = feedAll(flock);
    expect(fed.every((a) => a.fed)).toBe(true);
    const petted = petAnimal(fed, 1);
    expect(petted[1]?.petted).toBe(true);
    expect(petted[1]?.mood).toBe(6);
    expect(petted[0]?.petted).toBe(false);
    let mood = newAnimal('chicken');
    for (let i = 0; i < 20; i += 1) mood = petAnimal([mood], 0)[0] ?? mood;
    expect(mood.mood).toBe(10);
  });

  it('petting a missing slot changes nothing', () => {
    const flock = [newAnimal('chicken')];
    expect(petAnimal(flock, 3)).toEqual(flock);
  });
});

describe('the new day', () => {
  it('a fed animal lays one egg; a hungry one lays nothing', () => {
    const flock = [{ ...newAnimal('chicken'), fed: true }, newAnimal('chicken')];
    const { eggs } = produceEggs(flock, CHICKEN, 1);
    expect(eggs).toHaveLength(1);
  });

  it('a happy animal (mood 5 or more) can lay a good egg, and the roll decides which', () => {
    const happy = [{ ...newAnimal('chicken'), fed: true, mood: 9 }];
    const low = [{ ...newAnimal('chicken'), fed: true, mood: 2 }];
    const goodFor = (flock: Animal[], r: number) => produceEggs(flock, CHICKEN, r).eggs[0]?.quality;
    expect(goodFor(happy, 0.1)).toBe('good');
    expect(goodFor(happy, 0.9)).toBe('normal');
    expect(goodFor(low, 0.1)).toBe('normal');
  });

  it('after the day, care is used up: fed, petted and milked reset, a petted animal gains mood, an unfed one loses it', () => {
    const flock: Animal[] = [
      { kind: 'chicken', fed: true, petted: true, milked: true, mood: 5 },
      { kind: 'chicken', fed: false, petted: false, milked: false, mood: 5 },
      { kind: 'chicken', fed: false, petted: false, milked: false, mood: 0 },
    ];
    const next = dailyCare(flock);
    expect(next.map((a) => [a.fed, a.petted, a.milked])).toEqual([
      [false, false, false],
      [false, false, false],
      [false, false, false],
    ]);
    expect(next.map((a) => a.mood)).toEqual([6, 4, 0]);
  });
});

describe('milk quality (cows)', () => {
  it('a cow with mood below 5 always gives normal milk', () => {
    expect(milkQuality(4, 0, MILK)).toBe('normal');
  });

  it('mood 5 or more gives good milk on a lucky roll, and the roll decides which', () => {
    expect(milkQuality(5, 0.1, MILK)).toBe('good');
    expect(milkQuality(5, 0.5, MILK)).toBe('normal');
  });

  it('mood 9 or more can give fine milk, the best grade, on a rarer roll', () => {
    expect(milkQuality(9, 0.05, MILK)).toBe('fine');
    expect(milkQuality(9, 0.2, MILK)).toBe('good');
    expect(milkQuality(8, 0.05, MILK)).toBe('good');
  });
});

describe('wool (sheep)', () => {
  it('a sheep that ate gains one day of wool at the new day; a hungry one does not', () => {
    const flock = [newAnimal('sheep'), { ...newAnimal('sheep'), fed: true }];
    const grown = growWool(flock, WOOL.everyDays);
    expect(grown.map((a) => a.woolDays ?? 0)).toEqual([0, 1]);
  });

  it('wool is ready after three fed days, and not before', () => {
    let flock = [{ ...newAnimal('sheep'), fed: true }];
    flock = growWool(flock, WOOL.everyDays);
    flock = growWool(flock, WOOL.everyDays);
    expect(woolReady(flock[0] ?? newAnimal('sheep'), WOOL.everyDays)).toBe(false);
    flock = growWool(flock, WOOL.everyDays);
    expect(woolReady(flock[0] ?? newAnimal('sheep'), WOOL.everyDays)).toBe(true);
  });

  it('the wool stops at ready: more fed days do not make it longer than the interval', () => {
    const flock = growWool([{ ...sheep(3), fed: true }], WOOL.everyDays);
    expect(flock[0]?.woolDays).toBe(3);
  });

  it('shearing one sheep resets its wool and leaves the others alone', () => {
    const flock = [sheep(3), sheep(2)];
    const shorn = shearAt(flock, 0);
    expect(shorn.map((a) => a.woolDays)).toEqual([0, 2]);
  });

  it('shearing a missing seat changes nothing', () => {
    const flock = [sheep(3)];
    expect(shearAt(flock, 4)).toEqual(flock);
  });

  it('the wool survives the new day care (only feeding, petting and milking are reset)', () => {
    const next = dailyCare([sheep(2, { fed: true, petted: true })]);
    expect(next[0]).toMatchObject({ fed: false, petted: false, woolDays: 2 });
  });

  it('wool quality follows the mood like milk: a happy sheep can give good wool, a very happy one fine wool', () => {
    expect(productQuality(4, 0, WOOL)).toBe('normal');
    expect(productQuality(5, 0.1, WOOL)).toBe('good');
    expect(productQuality(9, 0.05, WOOL)).toBe('fine');
    expect(productQuality(8, 0.05, WOOL)).toBe('good');
  });
});
