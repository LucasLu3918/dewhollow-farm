import { describe, expect, it } from 'vitest';
import type { ContentPack, MapDef } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { addItem, countOf, createInventory } from '../domain/inventory';
import { newAnimal } from '../domain/animals';
import { executeCommand, type Command } from './game-commands';
import { createContentIndex, type ContentIndex } from './content-index';
import mine from '../../content/mine.json';

/**
 * M4c：牧場與牛。小地圖：院子 yard（雜貨店櫃檯 Q 在 (2,2)；通往牧草地的門 G 要春 15 天起；通往牛舍的門 K 要牛舍已改建）、
 * 牧草地 pasture（只有空地）、牛舍 cowbarn（座位在 (1,1) 與 (4,1)，乾草槽 T 在 (3,2)）。
 * 雞舍 coop 的規則已由 coop.spec.ts 驗證，這裡只看牛。
 */
const yard: MapDef = {
  id: 'yard',
  name: '院子',
  width: 5,
  height: 4,
  rows: ['#####', '.....', '..Q.G', 'B.K..'],
  legend: {
    '#': { kind: 'wall' },
    '.': { kind: 'grass' },
    Q: { kind: 'shop', shop: 'general' },
    B: { kind: 'bed' },
    G: { kind: 'door', to: 'pasture', requires: { type: 'date', season: 'spring', day: 15, hint: '春 15 天起才開放' } },
    K: {
      kind: 'door',
      to: 'cowbarn',
      requires: { type: 'flag', flag: 'cowbarn', hint: '牛舍還沒改建，到雜貨店找人改建（5000 金）' },
    },
  },
  spawn: { x: 1, y: 1 },
};

const pasture: MapDef = {
  id: 'pasture',
  name: '牧草地',
  width: 5,
  height: 3,
  rows: ['#####', '.....', '#####'],
  legend: { '#': { kind: 'fence' }, '.': { kind: 'grass' } },
  spawn: { x: 1, y: 1 },
};

const cowbarn: MapDef = {
  id: 'cowbarn',
  name: '牛舍',
  width: 6,
  height: 5,
  rows: ['######', '#P..P#', '#..T.#', '#....#', '##D###'],
  legend: {
    '#': { kind: 'wall' },
    '.': { kind: 'floor' },
    P: { kind: 'floor', slot: true },
    T: { kind: 'trough' },
    D: { kind: 'door', to: 'yard', spawn: { x: 4, y: 3 } },
  },
  spawn: { x: 2, y: 3 },
  flock: 'cows',
};

const content: ContentPack = {
  crops: [{ id: 'sweet-radish', name: '甜蘿蔔', seedPrice: 20, growthDays: 2, seasons: ['spring'] }],
  npcs: [],
  schedule: { periods: { noon: 720, evening: 1020 }, entries: [] },
  heartEvents: [],
  friendship: { pointsPerHeart: 100, maxHearts: 10, earlyCap: { hearts: 4, untilSeason: 'summer' }, talkPoints: 10, gift: { love: 80, neutral: 30, hate: -40 }, cropQuality: { minHearts: 2, perResident: 0.05, cap: 0.15 } },
  items: [
    { id: 'hay', name: '乾草', kind: 'material', maxStack: 99, sellPrice: 2 },
    { id: 'egg', name: '雞蛋', kind: 'animal', maxStack: 99, sellPrice: 25 },
    { id: 'milk', name: '牛奶', kind: 'animal', maxStack: 99, sellPrice: 60 },
    { id: 'building.cowbarn', name: '牛舍改建', kind: 'building', maxStack: 1 },
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
  ],
  shops: [
    {
      id: 'general',
      name: '雜貨店',
      stock: [
        { itemId: 'hay', price: 5 },
        { itemId: 'animal.cow', price: 1200 },
        { itemId: 'building.cowbarn', price: 5000 },
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
  maps: [yard, pasture, cowbarn],
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
/** 站在牛舍的 (1,2)，面向上方的座位 (1,1)。 */
const beforeSeatLeft = { x: 1, y: 2, facing: 'up' as const };
/** 站在牛舍的 (2,2)，面向右邊的乾草槽 (3,2)。 */
const beforeTrough = { x: 2, y: 2, facing: 'right' as const };

describe('remodeling the cow barn', () => {
  it('costs 5000 gold at the general store and marks the barn as remodeled, taking no item', () => {
    const state = fresh({ gold: 6000, player: atCounter });
    const out = run(state, { type: 'buy', shopId: 'general', itemId: 'building.cowbarn', count: 1 });
    expect(out.state.gold).toBe(1000);
    expect(out.state.flags.cowbarn).toBe(true);
    expect(out.state.inventory).toEqual(state.inventory);
  });

  it('refuses when the gold is short, and changes nothing', () => {
    const out = run(fresh({ gold: 4999, player: atCounter }), { type: 'buy', shopId: 'general', itemId: 'building.cowbarn', count: 1 });
    expect(out.state.gold).toBe(4999);
    expect(out.state.flags.cowbarn).toBeUndefined();
    expect(out.messages).toContain('金幣不夠');
  });

  it('a second remodel is refused and does not take the gold again', () => {
    const done = fresh({ gold: 9000, flags: { cowbarn: true }, player: atCounter });
    const out = run(done, { type: 'buy', shopId: 'general', itemId: 'building.cowbarn', count: 1 });
    expect(out.state.gold).toBe(9000);
    expect(out.messages).toContain('已經有了，不用再做一個');
  });
});

describe('buying a cow', () => {
  it('is refused until the barn is remodeled, and nothing is taken', () => {
    const out = run(fresh({ gold: 3000, player: atCounter }), { type: 'buy', shopId: 'general', itemId: 'animal.cow', count: 1 });
    expect(out.state.cows).toEqual([]);
    expect(out.state.gold).toBe(3000);
    expect(out.messages).toContain('牛舍還沒改建，先到雜貨店找人改建');
  });

  it('after the remodel, a cow costs 1200 gold and moves into the barn', () => {
    const out = run(fresh({ gold: 2000, flags: { cowbarn: true }, player: atCounter }), { type: 'buy', shopId: 'general', itemId: 'animal.cow', count: 1 });
    expect(out.state.gold).toBe(800);
    expect(out.state.cows).toEqual([newAnimal('cow')]);
    expect(out.state.animals).toEqual([]);
  });

  it('the barn has two seats: a third cow is refused and nothing is taken', () => {
    const full = fresh({ gold: 5000, flags: { cowbarn: true }, cows: [newAnimal('cow'), newAnimal('cow')], player: atCounter });
    const out = run(full, { type: 'buy', shopId: 'general', itemId: 'animal.cow', count: 1 });
    expect(out.state.cows).toHaveLength(2);
    expect(out.state.gold).toBe(5000);
    expect(out.messages).toContain('牛舍已經滿了');
  });
});

describe('caring for the cows', () => {
  it('feeding at the trough uses one hay and feeds every cow in the barn', () => {
    const state = with_(fresh({ mapId: 'cowbarn', cows: [newAnimal('cow'), newAnimal('cow')], player: beforeTrough }), { hay: 2 });
    const out = run(state, { type: 'interact' });
    expect(countOf(out.state.inventory, 'hay')).toBe(1);
    expect(out.state.cows.every((c) => c.fed)).toBe(true);
    expect(out.messages).toContain('餵了牛');
  });

  it('with no cow in the barn, the trough says so', () => {
    const state = with_(fresh({ mapId: 'cowbarn', player: beforeTrough }), { hay: 1 });
    expect(run(state, { type: 'interact' }).messages).toContain('牛舍裡還沒有牛');
  });

  it('the first visit to a cow pets it; the second milks it once it has eaten', () => {
    const cow = { ...newAnimal('cow'), fed: true };
    const here = fresh({ mapId: 'cowbarn', cows: [cow], player: beforeSeatLeft, gold: 0 });
    const petted = run(here, { type: 'interact' });
    expect(petted.state.cows[0]).toMatchObject({ petted: true, milked: false, mood: 6 });
    expect(petted.messages).toContain('摸了摸牛');

    const milked = run(petted.state, { type: 'interact' });
    expect(countOf(milked.state.inventory, 'milk')).toBe(1);
    expect(milked.state.cows[0]?.milked).toBe(true);
    expect(milked.messages.join('\n')).toContain('牛奶');
  });

  it('milking takes the time of one action and no energy', () => {
    const here = fresh({ mapId: 'cowbarn', cows: [{ ...newAnimal('cow'), fed: true, petted: true }], player: beforeSeatLeft });
    const out = run(here, { type: 'interact' });
    expect(out.state.energy).toEqual(here.energy);
    expect(out.state.calendar.minuteOfDay).toBe(here.calendar.minuteOfDay + 10);
  });

  it('an unfed cow is not milked, and says it has not eaten yet', () => {
    const here = fresh({ mapId: 'cowbarn', cows: [{ ...newAnimal('cow'), petted: true }], player: beforeSeatLeft });
    const out = run(here, { type: 'interact' });
    expect(countOf(out.state.inventory, 'milk')).toBe(0);
    expect(out.state.cows[0]?.milked).toBe(false);
    expect(out.messages).toContain('牛還沒吃飽，先去乾草槽餵牠');
  });

  it('a cow is cared for once a day: after milking, another visit changes nothing', () => {
    const here = fresh({ mapId: 'cowbarn', cows: [{ ...newAnimal('cow'), fed: true, petted: true, milked: true }], player: beforeSeatLeft });
    const out = run(here, { type: 'interact' });
    expect(out.state.cows[0]).toEqual(here.cows[0]);
    expect(out.messages).toContain('今天已經照顧過這頭牛了');
  });
});

describe('the new day with cows', () => {
  it('a cow that ate and was petted gains mood; the care resets for the next day', () => {
    const sleepy = (cows: GameState['cows']) =>
      run(fresh({ cows, player: { x: 1, y: 3, facing: 'left' }, energy: { current: 10, max: 40 } }), { type: 'interact' });
    const out = sleepy([{ ...newAnimal('cow'), fed: true, petted: true, milked: true }]);
    expect(out.state.cows[0]).toMatchObject({ fed: false, petted: false, milked: false, mood: 6 });
  });

  it('a cow that was not fed loses mood', () => {
    const out = run(fresh({ cows: [newAnimal('cow')], player: { x: 1, y: 3, facing: 'left' }, energy: { current: 10, max: 40 } }), {
      type: 'interact',
    });
    expect(out.state.cows[0]?.mood).toBe(4);
  });

  it('the cows do not lay eggs: no egg reaches the bag', () => {
    const out = run(fresh({ cows: [{ ...newAnimal('cow'), fed: true }], player: { x: 1, y: 3, facing: 'left' }, energy: { current: 10, max: 40 } }), {
      type: 'interact',
    });
    expect(countOf(out.state.inventory, 'egg')).toBe(0);
    expect(countOf(out.state.inventory, 'milk')).toBe(0);
  });
});

describe('doors to the pasture and the barn', () => {
  it('the pasture gate stays shut before spring day 15, and says when it opens', () => {
    const out = run(fresh({ player: { x: 3, y: 2, facing: 'right' } }), { type: 'move', direction: 'right' });
    expect(out.state.mapId).toBe('yard');
    expect(out.messages).toContain('春 15 天起才開放');
  });

  it('the pasture gate opens on spring day 15', () => {
    const out = run(
      fresh({ player: { x: 3, y: 2, facing: 'right' }, calendar: { year: 1, season: 'spring', day: 15, minuteOfDay: 360 } }),
      { type: 'move', direction: 'right' },
    );
    expect(out.state.mapId).toBe('pasture');
  });

  it('the barn door stays shut until the barn is remodeled', () => {
    const out = run(fresh({ player: { x: 1, y: 3, facing: 'right' } }), { type: 'move', direction: 'right' });
    expect(out.state.mapId).toBe('yard');
    expect(out.messages).toContain('牛舍還沒改建，到雜貨店找人改建（5000 金）');
  });

  it('after the remodel, the barn door leads inside', () => {
    const out = run(fresh({ flags: { cowbarn: true }, player: { x: 1, y: 3, facing: 'right' } }), { type: 'move', direction: 'right' });
    expect(out.state.mapId).toBe('cowbarn');
    expect(out.state.player).toMatchObject({ x: 2, y: 3 });
  });
});
