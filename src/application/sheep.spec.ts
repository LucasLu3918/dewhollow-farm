import { describe, expect, it } from 'vitest';
import type { ContentPack, MapDef } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { addItem, countOf, createInventory } from '../domain/inventory';
import { newAnimal } from '../domain/animals';
import { executeCommand, type Command } from './game-commands';
import { createContentIndex, type ContentIndex } from './content-index';
import mine from '../../content/mine.json';

/**
 * 羊（與布）：小地圖 yard（雜貨店櫃檯 Q 在 (2,2)，床 B 在 (0,3)）與牧草地 pasture。
 * 牧草地的羊圈有 3 個座位 S（(1,1)、(3,1)、(5,1)），乾草槽 T 在 (3,2)；羊的座位在牧草地（flock 為 sheep）。
 */
const yard: MapDef = {
  id: 'yard',
  name: '院子',
  width: 6,
  height: 4,
  rows: ['######', '......', '..Q...', 'B.....'],
  legend: {
    '#': { kind: 'wall' },
    '.': { kind: 'grass' },
    Q: { kind: 'shop', shop: 'general' },
    B: { kind: 'bed' },
  },
  spawn: { x: 1, y: 1 },
};

const pasture: MapDef = {
  id: 'pasture',
  name: '牧草地',
  width: 7,
  height: 5,
  rows: ['#######', '#S.S.S#', '#..T..#', '#.....#', '#######'],
  legend: {
    '#': { kind: 'fence' },
    '.': { kind: 'grass' },
    S: { kind: 'grass', slot: true },
    T: { kind: 'trough' },
  },
  spawn: { x: 1, y: 3 },
  flock: 'sheep',
};

const content: ContentPack = {
  crops: [{ id: 'sweet-radish', name: '甜蘿蔔', seedPrice: 20, growthDays: 2, seasons: ['spring'] }],
  npcs: [],
  schedule: { periods: { noon: 720, evening: 1020 }, entries: [] },
  heartEvents: [],
  friendship: { pointsPerHeart: 100, maxHearts: 10, earlyCap: { hearts: 4, untilSeason: 'summer' }, talkPoints: 10, gift: { love: 80, neutral: 30, hate: -40 }, cropQuality: { minHearts: 2, perResident: 0.05, cap: 0.15 } },
  items: [
    { id: 'hay', name: '乾草', kind: 'material', maxStack: 99 },
    { id: 'wool', name: '羊毛', kind: 'animal', maxStack: 99, sellPrice: 40 },
    { id: 'egg', name: '雞蛋', kind: 'animal', maxStack: 99, sellPrice: 25 },
  ],
  fish: [],
  crafting: [],
  talents: { unlockLevel: 5, defs: [] },
  mine,
  processing: [],
  recipes: [],
  animals: [
    { id: 'chicken', name: '雞', eggItem: 'egg', eggQuality: 0.3 },
    { id: 'cow', name: '牛', milk: { item: 'milk', goodChance: 0.3, fineChance: 0.1 } },
    { id: 'sheep', name: '羊', wool: { item: 'wool', everyDays: 3, goodChance: 0.3, fineChance: 0.1 } },
  ],
  shops: [
    {
      id: 'general',
      name: '雜貨店',
      stock: [
        { itemId: 'hay', price: 5 },
        { itemId: 'animal.sheep', price: 600 },
      ],
      upgrades: [],
    },
  ],
  start: { mapId: 'yard', gold: 400, seeds: {} },
  tuning: {
    energy: { max: 40, costs: { till: 2, water: 1, plant: 1, harvest: 1, ship: 0, chop: 3, forage: 1, mine: 2, fish: 2, cook: 1, process: 1 } },
    inventory: { capacity: 8 },
    harvest: { min: 1, max: 5 },
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
    gathering: { wood: { min: 1, max: 3 }, forage: { min: 1, max: 2 }, stone: { min: 1, max: 2 }, ore: { min: 1, max: 2 } },
  },
  weather: {
    spring: [{ weather: 'sunny', weight: 1 }],
    summer: [{ weather: 'sunny', weight: 1 }],
    autumn: [{ weather: 'sunny', weight: 1 }],
    winter: [{ weather: 'snow', weight: 1 }],
  },
  maps: [yard, pasture],
};

const index: ContentIndex = createContentIndex(content);

function fresh(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createNewGame(content, 7),
    mapId: 'yard',
    toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
    worldChanges: {},
    fishing: null,
    animals: [],
    cows: [],
    sheep: [],
    ...overrides,
  };
}

function with_(state: GameState, items: Record<string, number>): GameState {
  let inventory = createInventory(8);
  for (const [id, count] of Object.entries(items)) {
    const added = addItem(inventory, index.item(id), count);
    if (!added.ok) throw new Error('背包放不下');
    inventory = added.value;
  }
  return { ...state, inventory: { ...state.inventory, stacks: inventory.stacks } };
}

function run(state: GameState, command: Command) {
  return executeCommand(state, command, index);
}

/** 站在雜貨店櫃檯（2,2）的正下方，面向上。 */
const atCounter = { x: 2, y: 3, facing: 'up' as const };
/** 羊圈的左邊座位 (1,1)，站在它的正下方 (1,2) 面向上。 */
const beforeSeatLeft = { x: 1, y: 2, facing: 'up' as const };
/** 站在乾草槽 (3,2) 的正下方 (3,3)，面向上。 */
const beforeTrough = { x: 3, y: 3, facing: 'up' as const };
/** 站在小屋的床旁邊，面向床。 */
const beforeBed = { x: 1, y: 3, facing: 'left' as const };

/** 一隻已經長出羊毛（或還沒）的羊：摸過與否、羊毛幾天、心情。 */
function sheepWith(extra: Partial<ReturnType<typeof newAnimal>> & { woolDays?: number } = {}) {
  return { ...newAnimal('sheep'), ...extra };
}

describe('buying a sheep', () => {
  it('costs 600 gold, takes the next seat in the pasture, and needs no barn remodel', () => {
    const out = run(fresh({ gold: 1000, player: atCounter }), { type: 'buy', shopId: 'general', itemId: 'animal.sheep', count: 1 });
    expect(out.state.gold).toBe(400);
    expect(out.state.sheep).toHaveLength(1);
    expect(out.state.sheep[0]).toMatchObject({ kind: 'sheep', fed: false, woolDays: 0 });
    expect(out.state.cows).toEqual([]);
    expect(out.state.animals).toEqual([]);
  });

  it('the pasture has three seats: a fourth sheep is refused and nothing is taken', () => {
    const full = fresh({ gold: 5000, sheep: [sheepWith(), sheepWith(), sheepWith()], player: atCounter });
    const out = run(full, { type: 'buy', shopId: 'general', itemId: 'animal.sheep', count: 1 });
    expect(out.state.sheep).toHaveLength(3);
    expect(out.state.gold).toBe(5000);
    expect(out.messages).toContain('羊圈已經滿了');
  });

  it('refuses when the gold is short', () => {
    const out = run(fresh({ gold: 599, player: atCounter }), { type: 'buy', shopId: 'general', itemId: 'animal.sheep', count: 1 });
    expect(out.state.sheep).toEqual([]);
    expect(out.messages).toContain('金幣不夠');
  });
});

describe('caring for the sheep', () => {
  it('the first visit pets the sheep (mood +1) and takes the time of one action, no energy', () => {
    const here = fresh({ mapId: 'pasture', sheep: [{ ...newAnimal('sheep'), fed: true }], player: beforeSeatLeft });
    const out = run(here, { type: 'interact' });
    expect(out.state.sheep[0]).toMatchObject({ petted: true, mood: 6 });
    expect(out.messages).toContain('摸了摸羊');
    expect(out.state.energy).toEqual(here.energy);
    expect(out.state.calendar.minuteOfDay).toBe(here.calendar.minuteOfDay + 10);
  });

  it('a petted sheep with ready wool is sheared: one wool goes in the bag, the wool count resets', () => {
    const here = fresh({ mapId: 'pasture', sheep: [sheepWith({ fed: true, petted: true, mood: 4, woolDays: 3 })], player: beforeSeatLeft });
    const out = run(here, { type: 'interact' });
    expect(countOf(out.state.inventory, 'wool')).toBe(1);
    expect(out.state.inventory.stacks.find((s) => s.itemId === 'wool')?.quality).toBe('normal');
    expect(out.state.sheep[0]?.woolDays).toBe(0);
    expect(out.messages.join('\n')).toContain('羊毛');
    expect(out.state.energy).toEqual(here.energy);
    expect(out.state.calendar.minuteOfDay).toBe(here.calendar.minuteOfDay + 10);
  });

  it('wool that is not ready yet is not sheared, and the game says so', () => {
    const here = fresh({ mapId: 'pasture', sheep: [sheepWith({ fed: true, petted: true, woolDays: 2 })], player: beforeSeatLeft });
    const out = run(here, { type: 'interact' });
    expect(countOf(out.state.inventory, 'wool')).toBe(0);
    expect(out.state.sheep[0]?.woolDays).toBe(2);
    expect(out.messages).toContain('羊毛還沒長好，過幾天再來剪');
  });

  it('a sheep is sheared once: a second visit the same day does not give more wool', () => {
    const here = fresh({ mapId: 'pasture', sheep: [sheepWith({ fed: true, petted: true, mood: 4, woolDays: 3 })], player: beforeSeatLeft });
    const once = run(here, { type: 'interact' });
    const twice = run(once.state, { type: 'interact' });
    expect(countOf(twice.state.inventory, 'wool')).toBe(1);
    expect(twice.messages).toContain('羊毛還沒長好，過幾天再來剪');
  });

  it('the trough feeds every sheep with one hay, and says so', () => {
    const state = with_(fresh({ mapId: 'pasture', sheep: [sheepWith(), sheepWith()], player: beforeTrough }), { hay: 2 });
    const out = run(state, { type: 'interact' });
    expect(countOf(out.state.inventory, 'hay')).toBe(1);
    expect(out.state.sheep.every((s) => s.fed)).toBe(true);
    expect(out.messages).toContain('餵了羊');
  });

  it('with no sheep in the pasture, the trough says so', () => {
    const state = with_(fresh({ mapId: 'pasture', player: beforeTrough }), { hay: 1 });
    expect(run(state, { type: 'interact' }).messages).toContain('羊圈裡還沒有羊');
  });
});

describe('the new day with sheep', () => {
  it('a fed sheep gains a day of wool at the new day; a hungry one does not', () => {
    const out = run(fresh({ sheep: [sheepWith({ fed: true }), sheepWith()], player: beforeBed, energy: { current: 10, max: 40 } }), {
      type: 'interact',
    });
    expect(out.state.sheep.map((s) => s.woolDays)).toEqual([1, 0]);
    expect(out.state.sheep[0]).toMatchObject({ fed: false, petted: false });
  });

  it('three fed days in a row make the wool ready', () => {
    let state = fresh({ sheep: [sheepWith()], player: beforeBed, energy: { current: 10, max: 40 } });
    for (let day = 0; day < 3; day += 1) {
      state = run({ ...state, sheep: state.sheep.map((s) => ({ ...s, fed: true })) }, { type: 'interact' }).state;
    }
    expect(state.sheep[0]?.woolDays).toBe(3);
  });

  it('a sheep that was not fed does not grow wool, and loses mood', () => {
    const out = run(fresh({ sheep: [sheepWith()], player: beforeBed, energy: { current: 10, max: 40 } }), { type: 'interact' });
    expect(out.state.sheep[0]).toMatchObject({ woolDays: 0, mood: 4 });
  });
});
