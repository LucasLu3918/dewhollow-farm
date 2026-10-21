import { describe, expect, it } from 'vitest';
import mineRulesJson from '../../content/mine.json';
import type { ContentPack, MapDef } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { countOf } from '../domain/inventory';
import { rollInt } from '../domain/random';
import { executeCommand, type Command } from './game-commands';
import { createContentIndex, type ContentIndex } from './content-index';

/**
 * 技能天賦（M4 P1）：技能 5 級才能選，每項技能只能選一次；天賦只改產出與售價，不改體力成本。
 * 這裡的天賦機率都設成 1，讓測試不依賴隨機數。
 */
const grove: MapDef = {
  id: 'grove',
  name: '樹林',
  width: 9,
  height: 7,
  rows: ['#########', '#F.H.O.S#', '#.......#', '#~.B....#', '#.......#', '#.......#', '#########'],
  legend: {
    '#': { kind: 'wall' },
    '.': { kind: 'grass' },
    F: { kind: 'field' },
    H: { kind: 'forage' },
    O: { kind: 'ore' },
    S: { kind: 'rock' },
    '~': { kind: 'water' },
    B: { kind: 'bed' },
  },
  spawn: { x: 2, y: 2 },
};

const content: ContentPack = {
  crops: [{ id: 'dew-grass', name: '晨露草', seedPrice: 10, growthDays: 1, seasons: ['spring'] }],
  npcs: [],
  schedule: { periods: { noon: 720, evening: 1020 }, entries: [] },
  heartEvents: [],
  friendship: { pointsPerHeart: 100, maxHearts: 10, earlyCap: { hearts: 4, untilSeason: 'summer' }, talkPoints: 10, gift: { love: 80, neutral: 30, hate: -40 }, cropQuality: { minHearts: 2, perResident: 0.05, cap: 0.15 } },
  items: [
    { id: 'mint', name: '野薄荷', kind: 'forage', maxStack: 99, sellPrice: 14 },
    { id: 'copper-ore', name: '銅礦石', kind: 'ore', maxStack: 99 },
    { id: 'stone', name: '石頭', kind: 'material', maxStack: 99 },
  ],
  fish: [{ id: 'carp', name: '鯉魚', sellPrice: 30, seasons: ['spring'], weight: 1 }],
  animals: [],
  recipes: [{ id: 'pie', name: '派', ingredients: {}, energy: 5, level: 0, sellPrice: 20 }],
  crafting: [],
  processing: [],
  shops: [],
  start: { mapId: 'grove', gold: 0, seeds: {} },
  mine: mineRulesJson,
  talents: {
    unlockLevel: 5,
    defs: [
      { id: 'bountiful', skill: 'farming', name: '豐收手', description: '', effect: { type: 'extraYield', action: 'harvest', chance: 1 } },
      { id: 'market-sense', skill: 'farming', name: '行商眼', description: '', effect: { type: 'sellBonus', kinds: ['crop'], percent: 10 } },
      { id: 'wild-nose', skill: 'foraging', name: '野地鼻', description: '', effect: { type: 'extraYield', action: 'forage', chance: 1 } },
      { id: 'ore-sense', skill: 'mining', name: '礦脈眼', description: '', effect: { type: 'extraYield', action: 'mine', item: 'copper-ore', chance: 1 } },
      { id: 'keen-bite', skill: 'fishing', name: '好手氣', description: '', effect: { type: 'biteBonus', points: 10 } },
      { id: 'hearty-cook', skill: 'cooking', name: '好食量', description: '', effect: { type: 'dishEnergy', amount: 2 } },
    ],
  },
  tuning: {
    energy: { max: 40, costs: { till: 2, water: 1, plant: 1, harvest: 1, ship: 0, chop: 3, forage: 1, mine: 4, fish: 2, cook: 1, process: 1 } },
    inventory: { capacity: 8 },
    harvest: { min: 1, max: 2 },
    time: { wakeMinute: 360, minutesPerAction: 10, daysPerSeason: 20 },
    tools: { tiers: [{ energyDiscount: 0 }, { energyDiscount: 1 }, { energyDiscount: 1 }, { energyDiscount: 2 }] },
    fishing: { biteChance: 60, bobberBonus: 10, baitBonus: 20 },
    fertilizer: { basic: { goodBonus: 20, fineBonus: 0 }, fine: { goodBonus: 30, fineBonus: 15 } },
    processing: { slots: 3 },
    skills: {
      thresholds: [0, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650],
      xp: { till: 2, water: 1, plant: 2, harvest: 4, chop: 4, forage: 3, mine: 4, fish: 6, cook: 5, process: 4 },
      bonusFrom: 5,
      goodFrom: 4,
      goodChance: 0.2,
      fineFrom: 8,
      fineChance: 0.08,
    },
    gathering: { wood: { min: 1, max: 3 }, forage: { min: 1, max: 1 }, stone: { min: 1, max: 1 }, ore: { min: 1, max: 1 } },
  },
  weather: {
    spring: [{ weather: 'sunny', weight: 1 }],
    summer: [{ weather: 'sunny', weight: 1 }],
    autumn: [{ weather: 'sunny', weight: 1 }],
    winter: [{ weather: 'snow', weight: 1 }],
  },
  maps: [grove],
};

const index: ContentIndex = createContentIndex(content);

function base(overrides: Partial<GameState> = {}): GameState {
  return { ...createNewGame(content, 3), mapId: 'grove', ...overrides };
}

/** 站在 (x, y)，面向 facing（互動的對象是面前那一格）。 */
function standing(state: GameState, x: number, y: number, facing: GameState['player']['facing'] = 'up'): GameState {
  return { ...state, player: { x, y, facing } };
}

function run(state: GameState, command: Command) {
  return executeCommand(state, command, index);
}

/** 讓 (x, y) 的田成熟（可以直接收成）。 */
const ripePlot = { '1,1': { watered: true, dryDays: 0, crop: { cropId: 'dew-grass', growthDays: 1 } } };

describe('chooseTalent', () => {
  it('refuses before the skill reaches level 5, with a reason, and changes nothing', () => {
    const state = base({ skills: { ...createNewGame(content, 3).skills, farming: 199 } });
    const out = run(state, { type: 'chooseTalent', talentId: 'bountiful' });
    expect(out.messages).toEqual(['技能要到 5 級才能選天賦']);
    expect(out.state).toEqual(state);
  });

  it('lets the player choose at level 5 and remembers the choice for that skill only', () => {
    const state = base({ skills: { ...createNewGame(content, 3).skills, farming: 200 } });
    const out = run(state, { type: 'chooseTalent', talentId: 'bountiful' });
    expect(out.state.talents).toEqual({ farming: 'bountiful' });
    expect(out.messages[0]).toContain('豐收手');
  });

  it('does not spend energy or time', () => {
    const state = base({ skills: { ...createNewGame(content, 3).skills, farming: 200 } });
    const out = run(state, { type: 'chooseTalent', talentId: 'bountiful' });
    expect(out.state.energy).toEqual(state.energy);
    expect(out.state.calendar).toEqual(state.calendar);
  });

  it('allows only one talent per skill', () => {
    const state = base({ skills: { ...createNewGame(content, 3).skills, farming: 200 }, talents: { farming: 'bountiful' } });
    const out = run(state, { type: 'chooseTalent', talentId: 'market-sense' });
    expect(out.messages).toEqual(['這項技能已經選過天賦了']);
    expect(out.state).toEqual(state);
  });

  it('keeps the choice of other skills when a new one is made', () => {
    const state = base({
      skills: { ...createNewGame(content, 3).skills, farming: 200, foraging: 200 },
      talents: { farming: 'bountiful' },
    });
    const out = run(state, { type: 'chooseTalent', talentId: 'wild-nose' });
    expect(out.state.talents).toEqual({ farming: 'bountiful', foraging: 'wild-nose' });
  });

  it('refuses a talent that does not exist', () => {
    const state = base({ skills: { ...createNewGame(content, 3).skills, farming: 200 } });
    const out = run(state, { type: 'chooseTalent', talentId: 'nope' });
    expect(out.messages).toEqual(['沒有這個天賦']);
    expect(out.state).toEqual(state);
  });
});

describe('talent effects on output, not on energy', () => {
  it('a harvest talent adds exactly one crop and the energy cost stays the same', () => {
    const plain = standing(base({ plots: ripePlot }), 1, 2);
    const talented = { ...plain, talents: { farming: 'bountiful' as const } };
    const a = run(plain, { type: 'interact' });
    const b = run(talented, { type: 'interact' });
    const cropA = countOf(a.state.inventory, 'crop.dew-grass');
    const cropB = countOf(b.state.inventory, 'crop.dew-grass');
    expect(cropB - cropA).toBe(1);
    expect(b.state.energy.current).toBe(a.state.energy.current);
    expect(b.state.energy.current).toBe(plain.energy.current - 1);
  });

  it('a foraging talent adds one wild plant and keeps the energy cost', () => {
    const plain = standing(base(), 3, 2);
    const talented = { ...plain, talents: { foraging: 'wild-nose' as const } };
    const a = run(plain, { type: 'interact' });
    const b = run(talented, { type: 'interact' });
    expect(countOf(b.state.inventory, 'mint')).toBe(countOf(a.state.inventory, 'mint') + 1);
    expect(b.state.energy.current).toBe(a.state.energy.current);
  });

  it('a mining talent adds one ore only, not stone', () => {
    const pick = { ...standing(base({ tool: 'pick' }), 5, 2), talents: { mining: 'ore-sense' as const } };
    const ore = run(pick, { type: 'interact' });
    expect(countOf(ore.state.inventory, 'copper-ore')).toBe(2);

    const stone = { ...standing(base({ tool: 'pick' }), 7, 2), talents: { mining: 'ore-sense' as const } };
    const rock = run(stone, { type: 'interact' });
    expect(countOf(rock.state.inventory, 'stone')).toBe(1);
  });

  it('a fishing talent makes a bite possible where it was not before, and the energy cost stays the same', () => {
    // 找一個隨機數，讓投竿的骰子落在 60 到 69 之間：基礎機率 60 不上鉤，加 10 之後上鉤。
    let seed = 1;
    while (rollInt(seed, 0, 99).value !== 65) seed += 1;
    const cast = standing(base({ tool: 'rod', rng: seed }), 1, 4);
    const plain = run(cast, { type: 'interact' });
    const talented = run({ ...cast, talents: { fishing: 'keen-bite' } }, { type: 'interact' });
    expect(plain.state.fishing).toBeNull();
    expect(talented.state.fishing).toEqual({ fishId: 'carp' });
    expect(talented.state.energy.current).toBe(plain.state.energy.current);
  });

  it('a cooking talent adds to what a dish restores, but never past the maximum', () => {
    const state = base({ energy: { current: 0, max: 40 }, inventory: { capacity: 8, stacks: [{ itemId: 'dish.pie', quality: 'normal', count: 1 }] } });
    const plain = run(state, { type: 'eat', itemId: 'dish.pie' });
    const talented = run({ ...state, talents: { cooking: 'hearty-cook' } }, { type: 'eat', itemId: 'dish.pie' });
    expect(plain.state.energy.current).toBe(5);
    expect(talented.state.energy.current).toBe(7);
    const full = run({ ...state, energy: { current: 39, max: 40 }, talents: { cooking: 'hearty-cook' } }, { type: 'eat', itemId: 'dish.pie' });
    expect(full.state.energy.current).toBe(40);
  });

  it('a farming sell talent raises what the shipping box pays at sleep', () => {
    const shipped = { entries: [{ itemId: 'crop.dew-grass', quality: 'normal' as const, count: 1 }] };
    const sleepAt = (talents: GameState['talents']) => {
      const state = base({ shipBox: shipped, talents, player: { x: 3, y: 4, facing: 'up' } });
      return run(state, { type: 'interact' }).state;
    };
    const price = index.item('crop.dew-grass').sellPrice ?? 0;
    expect(sleepAt({}).gold).toBe(price);
    expect(sleepAt({ farming: 'market-sense' }).gold).toBe(Math.round((price * 110) / 100));
  });
});
