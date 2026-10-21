import { describe, expect, it } from 'vitest';
import {
  applySellBonus,
  biteBonusPoints,
  dishEnergyBonus,
  extraYieldChance,
  rollExtraYield,
  sellBonusPercent,
  type TalentDef,
  type TalentChoices,
} from './talents';

const bountiful: TalentDef = {
  id: 'bountiful',
  skill: 'farming',
  name: '豐收手',
  description: '收成時多一件的機率 +25%',
  effect: { type: 'extraYield', action: 'harvest', chance: 0.25 },
};
const marketSense: TalentDef = {
  id: 'market-sense',
  skill: 'farming',
  name: '行商眼',
  description: '作物售價 +10%',
  effect: { type: 'sellBonus', kinds: ['crop'], percent: 10 },
};
const oreSense: TalentDef = {
  id: 'ore-sense',
  skill: 'mining',
  name: '礦脈眼',
  description: '敲礦石時多一個的機率 +25%',
  effect: { type: 'extraYield', action: 'mine', item: 'copper-ore', chance: 0.25 },
};
const stoneHand: TalentDef = {
  id: 'stone-hand',
  skill: 'mining',
  name: '碎石手',
  description: '敲石頭時多一個的機率 +25%',
  effect: { type: 'extraYield', action: 'mine', item: 'stone', chance: 0.25 },
};
const keenBite: TalentDef = {
  id: 'keen-bite',
  skill: 'fishing',
  name: '好手氣',
  description: '上鉤機率 +10',
  effect: { type: 'biteBonus', points: 10 },
};
const heartyCook: TalentDef = {
  id: 'hearty-cook',
  skill: 'cooking',
  name: '好食量',
  description: '體力 +2',
  effect: { type: 'dishEnergy', amount: 2 },
};
const defs = [bountiful, marketSense, oreSense, stoneHand, keenBite, heartyCook];

describe('extraYieldChance', () => {
  it('is zero when nothing has been chosen', () => {
    const none: TalentChoices = {};
    expect(extraYieldChance(none, defs, 'harvest')).toBe(0);
  });

  it('counts only the talents that were chosen', () => {
    const chosen: TalentChoices = { farming: 'bountiful' };
    expect(extraYieldChance(chosen, defs, 'harvest')).toBe(0.25);
    expect(extraYieldChance(chosen, defs, 'forage')).toBe(0);
  });

  it('applies an item filter: the ore talent does not add stones', () => {
    const chosen: TalentChoices = { mining: 'ore-sense' };
    expect(extraYieldChance(chosen, defs, 'mine', 'copper-ore')).toBe(0.25);
    expect(extraYieldChance(chosen, defs, 'mine', 'stone')).toBe(0);
  });

  it('ignores a choice whose talent id is not in the definitions', () => {
    expect(extraYieldChance({ farming: 'missing' }, defs, 'harvest')).toBe(0);
  });
});

describe('rollExtraYield', () => {
  it('does not roll at all when the chance is zero, so the random sequence is unchanged', () => {
    expect(rollExtraYield(42, 0)).toEqual({ value: 0, rng: 42 });
  });

  it('always gives the extra item when the chance is one', () => {
    for (const seed of [1, 7, 12345]) expect(rollExtraYield(seed, 1).value).toBe(1);
  });

  it('is repeatable for the same seed and advances the random sequence when it rolls', () => {
    const first = rollExtraYield(99, 0.5);
    expect(rollExtraYield(99, 0.5)).toEqual(first);
    expect(first.rng).not.toBe(99);
  });
});

describe('sellBonusPercent', () => {
  it('is zero without a matching talent, and applies only to the kinds it names', () => {
    expect(sellBonusPercent({}, defs, 'crop')).toBe(0);
    expect(sellBonusPercent({ farming: 'market-sense' }, defs, 'crop')).toBe(10);
    expect(sellBonusPercent({ farming: 'market-sense' }, defs, 'fish')).toBe(0);
  });
});

describe('applySellBonus', () => {
  it('raises the price by a percentage and rounds to a whole number', () => {
    expect(applySellBonus(100, 10)).toBe(110);
    expect(applySellBonus(97, 10)).toBe(107);
    expect(applySellBonus(100, 0)).toBe(100);
  });
});

describe('biteBonusPoints and dishEnergyBonus', () => {
  it('read the chosen fishing and cooking talents', () => {
    expect(biteBonusPoints({}, defs)).toBe(0);
    expect(biteBonusPoints({ fishing: 'keen-bite' }, defs)).toBe(10);
    expect(dishEnergyBonus({}, defs)).toBe(0);
    expect(dishEnergyBonus({ cooking: 'hearty-cook' }, defs)).toBe(2);
  });
});
