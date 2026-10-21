import { describe, expect, it } from 'vitest';
import { dailyCare, feedAll, newAnimal, petAnimal, produceEggs, type Animal } from './animals';

const CHICKEN = { id: 'chicken', name: '雞', eggItem: 'egg', eggQuality: 0.3 };

describe('animal care', () => {
  it('a new animal is hungry and not yet petted, with a neutral mood', () => {
    expect(newAnimal('chicken')).toEqual({ kind: 'chicken', fed: false, petted: false, mood: 5 });
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

  it('after the day, care is used up: fed and petted reset, a petted animal gains mood, an unfed one loses it', () => {
    const flock: Animal[] = [
      { kind: 'chicken', fed: true, petted: true, mood: 5 },
      { kind: 'chicken', fed: false, petted: false, mood: 5 },
      { kind: 'chicken', fed: false, petted: false, mood: 0 },
    ];
    const next = dailyCare(flock);
    expect(next.map((a) => [a.fed, a.petted])).toEqual([
      [false, false],
      [false, false],
      [false, false],
    ]);
    expect(next.map((a) => a.mood)).toEqual([6, 4, 0]);
  });
});
