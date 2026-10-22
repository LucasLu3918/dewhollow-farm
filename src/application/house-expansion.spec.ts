import { describe, expect, it } from 'vitest';
import type { ContentPack, MapDef } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { createInventory } from '../domain/inventory';
import { executeCommand, type Command } from './game-commands';
import { createContentIndex, type ContentIndex } from './content-index';
import mine from '../../content/mine.json';

/**
 * 小屋擴建（金幣出口）：雜貨店賣兩次擴建（3000 與 8000 金，只買一次，第二次要先有第一次）。
 * 通往小屋的門在農場，落點依擴建的進度決定：house、house-wing、house-full。
 */
const yard: MapDef = {
  id: 'yard',
  name: '院子',
  width: 5,
  height: 4,
  rows: ['#####', '.....', '..Q..', '.....'],
  legend: { '#': { kind: 'wall' }, '.': { kind: 'grass' }, Q: { kind: 'shop', shop: 'general' } },
  spawn: { x: 1, y: 1 },
};

const farm: MapDef = {
  id: 'farm',
  name: '農場',
  width: 5,
  height: 3,
  rows: ['#####', '..D..', '#####'],
  legend: { '#': { kind: 'wall' }, '.': { kind: 'grass' }, D: { kind: 'door', to: 'house', spawn: { x: 1, y: 1 } } },
  spawn: { x: 1, y: 1 },
};

/** 三種小屋的地圖（格局細節由內容檔決定；這裡只需要能走進去）。 */
function houseLike(id: string): MapDef {
  return {
    id,
    name: id,
    width: 4,
    height: 3,
    rows: ['####', '....', '####'],
    legend: { '#': { kind: 'wall' }, '.': { kind: 'floor' } },
    spawn: { x: 1, y: 1 },
  };
}

const content: ContentPack = {
  crops: [{ id: 'sweet-radish', name: '甜蘿蔔', seedPrice: 20, growthDays: 2, seasons: ['spring'] }],
  npcs: [],
  schedule: { periods: { noon: 720, evening: 1020 }, entries: [] },
  heartEvents: [],
  friendship: { pointsPerHeart: 100, maxHearts: 10, earlyCap: { hearts: 4, untilSeason: 'summer' }, talkPoints: 10, gift: { love: 80, neutral: 30, hate: -40 }, cropQuality: { minHearts: 2, perResident: 0.05, cap: 0.15 } },
  items: [
    { id: 'building.house-wing', name: '小屋擴建：東側一間房', kind: 'building', maxStack: 1 },
    { id: 'building.house-full', name: '小屋擴建：廚房與工作台', kind: 'building', maxStack: 1 },
  ],
  fish: [],
  crafting: [],
  talents: { unlockLevel: 5, defs: [] },
  mine,
  processing: [],
  recipes: [],
  animals: [],
  shops: [
    {
      id: 'general',
      name: '雜貨店',
      stock: [
        { itemId: 'building.house-wing', price: 3000 },
        { itemId: 'building.house-full', price: 8000 },
      ],
      upgrades: [],
    },
  ],
  start: { mapId: 'farm', gold: 400, seeds: {} },
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
  maps: [yard, farm, houseLike('house'), houseLike('house-wing'), houseLike('house-full')],
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
    inventory: createInventory(8),
    ...overrides,
  };
}

function run(state: GameState, command: Command) {
  return executeCommand(state, command, index);
}

/** 站在雜貨店櫃檯（2,2）的正下方，面向上。 */
const atCounter = { x: 2, y: 3, facing: 'up' as const };

describe('expanding the house (buying)', () => {
  it('the east room costs 3000 gold, marks the house as expanded, and takes no item', () => {
    const state = fresh({ gold: 3500, player: atCounter });
    const out = run(state, { type: 'buy', shopId: 'general', itemId: 'building.house-wing', count: 1 });
    expect(out.state.gold).toBe(500);
    expect(out.state.flags['house-wing']).toBe(true);
    expect(out.state.inventory).toEqual(state.inventory);
  });

  it('the first expansion is bought once: a second purchase is refused and takes no gold', () => {
    const out = run(fresh({ gold: 9000, flags: { 'house-wing': true }, player: atCounter }), {
      type: 'buy',
      shopId: 'general',
      itemId: 'building.house-wing',
      count: 1,
    });
    expect(out.state.gold).toBe(9000);
    expect(out.messages).toContain('已經有了，不用再做一個');
  });

  it('the kitchen and workbench expansion needs the east room first, and takes no gold', () => {
    const out = run(fresh({ gold: 9000, player: atCounter }), { type: 'buy', shopId: 'general', itemId: 'building.house-full', count: 1 });
    expect(out.state.gold).toBe(9000);
    expect(out.state.flags['house-full']).toBeUndefined();
    expect(out.messages).toContain('要先擴建第一間房，才能擴建廚房與工作台');
  });

  it('after the east room, the kitchen and workbench expansion costs 8000 gold', () => {
    const out = run(fresh({ gold: 8500, flags: { 'house-wing': true }, player: atCounter }), {
      type: 'buy',
      shopId: 'general',
      itemId: 'building.house-full',
      count: 1,
    });
    expect(out.state.gold).toBe(500);
    expect(out.state.flags['house-full']).toBe(true);
  });

  it('refuses when the gold is short, and nothing changes', () => {
    const out = run(fresh({ gold: 2999, player: atCounter }), { type: 'buy', shopId: 'general', itemId: 'building.house-wing', count: 1 });
    expect(out.state.flags['house-wing']).toBeUndefined();
    expect(out.messages).toContain('金幣不夠');
  });
});

describe('walking into the expanded house', () => {
  const atFarmDoor = { x: 1, y: 1, facing: 'right' as const };

  it('before any expansion, the farm door leads to the base house', () => {
    const out = run(fresh({ mapId: 'farm', player: atFarmDoor }), { type: 'move', direction: 'right' });
    expect(out.state.mapId).toBe('house');
  });

  it('after the east room, the same door leads to the east-room layout', () => {
    const out = run(fresh({ mapId: 'farm', flags: { 'house-wing': true }, player: atFarmDoor }), { type: 'move', direction: 'right' });
    expect(out.state.mapId).toBe('house-wing');
  });

  it('after both expansions, the door leads to the full layout', () => {
    const out = run(fresh({ mapId: 'farm', flags: { 'house-wing': true, 'house-full': true }, player: atFarmDoor }), {
      type: 'move',
      direction: 'right',
    });
    expect(out.state.mapId).toBe('house-full');
  });
});
