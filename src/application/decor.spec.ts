import { describe, expect, it } from 'vitest';
import type { ContentPack, MapDef } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { addItem, countOf, createInventory, type Inventory } from '../domain/inventory';
import { executeCommand, type Command } from './game-commands';
import { createContentIndex, type ContentIndex } from './content-index';
import mine from '../../content/mine.json';

/**
 * 小屋裡的裝飾（擺放與收回）與服飾（穿戴）。裝飾只改變畫面與圖鑑，擺放與穿戴都不花體力與時間。
 */
const house: MapDef = {
  id: 'house',
  name: '小屋',
  width: 9,
  height: 7,
  rows: ['#########', '#B.T...K#', '#.......#', '#.......#', '#.P.L...#', '#.......#', '####D####'],
  legend: {
    '#': { kind: 'wall' },
    '.': { kind: 'floor' },
    B: { kind: 'bed' },
    T: { kind: 'workbench' },
    K: { kind: 'kitchen' },
    P: { kind: 'furniture', wardrobe: true },
    L: { kind: 'furniture', notice: 'mailbox' },
    D: { kind: 'door', to: 'farm', spawn: { x: 2, y: 5 } },
  },
  spawn: { x: 4, y: 5 },
};

const content: ContentPack = {
  crops: [{ id: 'sweet-radish', name: '甜蘿蔔', seedPrice: 20, growthDays: 2, seasons: ['spring'] }],
  npcs: [],
  schedule: { periods: { noon: 720, evening: 1020 }, entries: [] },
  heartEvents: [],
  friendship: { pointsPerHeart: 100, maxHearts: 10, earlyCap: { hearts: 4, untilSeason: 'summer' }, talkPoints: 10, gift: { love: 80, neutral: 30, hate: -40 }, cropQuality: { minHearts: 2, perResident: 0.05, cap: 0.15 } },
  items: [
    { id: 'hay', name: '乾草', kind: 'material', maxStack: 99 },
    { id: 'star-string', name: '星空燈串', kind: 'decor', maxStack: 20 },
    { id: 'night-canvas', name: '夜空畫板', kind: 'decor', maxStack: 20 },
    { id: 'clothes', name: '衣服', kind: 'decor', maxStack: 20, wearable: true },
    { id: 'sun-hat', name: '遮陽帽', kind: 'decor', maxStack: 20, wearable: true },
  ],
  fish: [],
  crafting: [],
  talents: { unlockLevel: 5, defs: [] },
  mine,
  processing: [],
  recipes: [],
  animals: [],
  shops: [],
  start: { mapId: 'house', gold: 100, seeds: {} },
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
  maps: [house],
};

const index: ContentIndex = createContentIndex(content);

function bagWith(items: Record<string, number>, capacity = 8): Inventory {
  let inventory = createInventory(capacity);
  for (const [id, count] of Object.entries(items)) {
    const added = addItem(inventory, index.item(id), count);
    if (!added.ok) throw new Error('背包放不下');
    inventory = added.value;
  }
  return inventory;
}

/** 小屋裡站在 (3,2)，面向下方的 (3,3)。 */
function inHouse(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createNewGame(content, 7),
    mapId: 'house',
    calendar: { year: 1, season: 'spring', day: 3, minuteOfDay: 600 },
    player: { x: 3, y: 2, facing: 'down' },
    inventory: bagWith({ 'star-string': 2, 'night-canvas': 1, hay: 1 }),
    energy: { current: 40, max: 40 },
    decor: {},
    wearing: {},
    ...overrides,
  };
}

function run(state: GameState, command: Command) {
  return executeCommand(state, command, index);
}

describe('裝飾的擺放', () => {
  it('面對空的地板擺一件：從背包拿走、記在這個房間，不花體力與時間', () => {
    const state = inHouse();
    const out = run(state, { type: 'placeDecor', itemId: 'star-string' });
    expect(countOf(out.state.inventory, 'star-string')).toBe(1);
    expect(out.state.decor.house).toEqual([{ itemId: 'star-string', x: 3, y: 3 }]);
    expect(out.state.energy).toEqual(state.energy);
    expect(out.state.calendar).toEqual(state.calendar);
  });

  it('沒指定物品時，擺背包裡第一件可以擺的裝飾（穿得上的衣服不算）', () => {
    const state = inHouse({ inventory: bagWith({ clothes: 1, 'night-canvas': 1 }) });
    const out = run(state, { type: 'placeDecor' });
    expect(out.state.decor.house).toEqual([{ itemId: 'night-canvas', x: 3, y: 3 }]);
    expect(countOf(out.state.inventory, 'clothes')).toBe(1);
  });

  it('背包裡沒有裝飾就說明，什麼都不變', () => {
    const state = inHouse({ inventory: bagWith({ hay: 1 }) });
    const out = run(state, { type: 'placeDecor' });
    expect(out.messages).toContain('背包裡沒有可以擺的裝飾');
    expect(out.state.decor).toEqual({});
  });

  it('牆與床不能擺', () => {
    const toWall = run(inHouse({ player: { x: 1, y: 2, facing: 'left' } }), { type: 'placeDecor', itemId: 'star-string' });
    expect(toWall.messages).toContain('這裡不能擺裝飾（要擺在空的地板上）');
    const toBed = run(inHouse({ player: { x: 1, y: 2, facing: 'up' } }), { type: 'placeDecor', itemId: 'star-string' });
    expect(toBed.messages).toContain('這裡不能擺裝飾（要擺在空的地板上）');
  });

  it('擺了會擋住床的動線就拒絕，背包與房間都不變', () => {
    const state = inHouse({ decor: { house: [{ itemId: 'star-string', x: 2, y: 1 }] }, player: { x: 1, y: 3, facing: 'up' } });
    const out = run(state, { type: 'placeDecor', itemId: 'night-canvas' });
    expect(out.messages).toContain('這裡擺了會擋住走路的路，床、櫃檯或門會走不到');
    expect(out.state.decor).toEqual(state.decor);
    expect(countOf(out.state.inventory, 'night-canvas')).toBe(1);
  });

  it('擺好的裝飾會擋住走路：往它的方向走不過去', () => {
    const state = inHouse({ decor: { house: [{ itemId: 'star-string', x: 3, y: 3 }] } });
    const out = run(state, { type: 'move', direction: 'down' });
    expect(out.state.player).toEqual({ x: 3, y: 2, facing: 'down' });
  });
});

describe('裝飾的收回', () => {
  it('面對擺好的裝飾按互動：收回背包，房間裡空出來', () => {
    const state = inHouse({ inventory: bagWith({ hay: 1 }), decor: { house: [{ itemId: 'star-string', x: 3, y: 3 }] } });
    const out = run(state, { type: 'interact' });
    expect(countOf(out.state.inventory, 'star-string')).toBe(1);
    expect(out.state.decor.house).toEqual([]);
  });

  it('背包放不下就收不回來，裝飾留在原地', () => {
    const state = inHouse({ inventory: bagWith({ hay: 1 }, 1), decor: { house: [{ itemId: 'star-string', x: 3, y: 3 }] } });
    const out = run(state, { type: 'interact' });
    expect(out.messages).toContain('背包已滿');
    expect(out.state.decor.house).toEqual([{ itemId: 'star-string', x: 3, y: 3 }]);
  });
});

describe('衣服與帽子的穿戴', () => {
  it('穿上衣服：從背包拿走，身上記一件', () => {
    const state = inHouse({ inventory: bagWith({ clothes: 1 }) });
    const out = run(state, { type: 'wear', itemId: 'clothes' });
    expect(out.state.wearing).toEqual({ player: 'clothes' });
    expect(countOf(out.state.inventory, 'clothes')).toBe(0);
    expect(out.state.energy).toEqual(state.energy);
  });

  it('每個角色只穿一件：再穿帽子時，衣服回到背包', () => {
    const state = inHouse({ inventory: bagWith({ 'sun-hat': 1 }), wearing: { player: 'clothes' } });
    const out = run(state, { type: 'wear', itemId: 'sun-hat' });
    expect(out.state.wearing).toEqual({ player: 'sun-hat' });
    expect(countOf(out.state.inventory, 'clothes')).toBe(1);
    expect(countOf(out.state.inventory, 'sun-hat')).toBe(0);
  });

  it('沒指定時穿背包裡第一件可以穿的東西', () => {
    const state = inHouse({ inventory: bagWith({ 'star-string': 1, clothes: 1 }) });
    const out = run(state, { type: 'wear' });
    expect(out.state.wearing).toEqual({ player: 'clothes' });
  });

  it('不能穿的東西（裝飾擺放用的燈串）會被拒絕', () => {
    const out = run(inHouse({ inventory: bagWith({ 'star-string': 1 }) }), { type: 'wear', itemId: 'star-string' });
    expect(out.messages).toContain('這件東西穿不了');
    expect(out.state.wearing).toEqual({});
  });

  it('背包裡沒有可以穿的東西就說明', () => {
    const out = run(inHouse({ inventory: bagWith({ hay: 1 }) }), { type: 'wear' });
    expect(out.messages).toContain('背包裡沒有可以穿的衣服');
  });

  it('換下來的衣服放不回背包時，換裝失敗，身上的衣服不變', () => {
    const state = inHouse({ inventory: bagWith({ 'sun-hat': 2, hay: 1 }, 2), wearing: { player: 'clothes' } });
    const out = run(state, { type: 'wear', itemId: 'sun-hat' });
    expect(out.messages).toContain('背包已滿');
    expect(out.state.wearing).toEqual({ player: 'clothes' });
  });

  it('脫下來：回到背包；沒穿東西時說明', () => {
    const out = run(inHouse({ inventory: bagWith({ hay: 1 }), wearing: { player: 'sun-hat' } }), { type: 'takeOff' });
    expect(out.state.wearing).toEqual({});
    expect(countOf(out.state.inventory, 'sun-hat')).toBe(1);
    const bare = run(inHouse(), { type: 'takeOff' });
    expect(bare.messages).toContain('身上沒有穿東西');
  });
});
