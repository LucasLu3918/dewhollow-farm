import { describe, expect, it } from 'vitest';
import type { ContentPack, MapDef } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { addItem, countOf, createInventory } from '../domain/inventory';
import type { MerchantRules } from '../domain/traveling-merchant';
import { executeCommand, type Command } from './game-commands';
import { createContentIndex, type ContentIndex } from './content-index';
import mine from '../../content/mine.json';

/**
 * 旅行商人（週五、六在鎮廣場）：貨架每週輪換，買的東西從金幣扣款，不花體力與時間，每週每件有上限。
 * 這裡的貨架固定是兩件（候選兩件、名額兩件），讓測試不依賴隨機結果。
 */
const plaza: MapDef = {
  id: 'plaza',
  name: '鎮廣場',
  width: 7,
  height: 5,
  rows: ['#######', '#.....#', '#.M...#', '#.....#', '#######'],
  legend: {
    '#': { kind: 'wall' },
    '.': { kind: 'grass' },
    M: { kind: 'shop', shop: 'traveling-merchant' },
  },
  spawn: { x: 1, y: 1 },
};

const merchant: MerchantRules = {
  weekdays: [4, 5],
  slots: { min: 2, max: 2 },
  perItemWeekly: 2,
  playMinutes: 2,
  candidates: [
    { itemId: 'star-string', price: 260 },
    { itemId: 'night-canvas', price: 320 },
  ],
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
  ],
  fish: [],
  crafting: [],
  talents: { unlockLevel: 5, defs: [] },
  mine,
  processing: [],
  recipes: [],
  animals: [],
  shops: [{ id: 'traveling-merchant', name: '旅行商人', stock: [], upgrades: [], rotating: true }],
  merchant,
  start: { mapId: 'plaza', gold: 1000, seeds: {} },
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
  maps: [plaza],
};

const index: ContentIndex = createContentIndex(content);

/** 春季第 day 天（第 1 天是週一；第 5、6 天是週五、週六；第 12 天是下週五）。 */
function onDay(day: number, overrides: Partial<GameState> = {}): GameState {
  return {
    ...createNewGame(content, 7),
    mapId: 'plaza',
    calendar: { year: 1, season: 'spring', day, minuteOfDay: 600 },
    player: { x: 2, y: 3, facing: 'up' },
    inventory: createInventory(8),
    gold: 1000,
    energy: { current: 40, max: 40 },
    ...overrides,
  };
}

function run(state: GameState, command: Command) {
  return executeCommand(state, command, index);
}

const buy = (itemId: string, count = 1): Command => ({ type: 'buy', shopId: 'traveling-merchant', itemId, count });

describe('旅行商人的買賣', () => {
  it('週五在櫃檯前買一件：扣金幣、進背包，不花體力也不花時間', () => {
    const state = onDay(5);
    const out = run(state, buy('star-string'));
    expect(out.state.gold).toBe(740);
    expect(countOf(out.state.inventory, 'star-string')).toBe(1);
    expect(out.state.energy).toEqual(state.energy);
    expect(out.state.calendar).toEqual(state.calendar);
  });

  it('週六也能買（同一週、同一份貨架）', () => {
    const out = run(onDay(6), buy('night-canvas'));
    expect(out.state.gold).toBe(680);
    expect(countOf(out.state.inventory, 'night-canvas')).toBe(1);
  });

  it('平日（週一）旅行商人不在，買不到，也不扣錢', () => {
    const out = run(onDay(1), buy('star-string'));
    expect(out.state.gold).toBe(1000);
    expect(countOf(out.state.inventory, 'star-string')).toBe(0);
    expect(out.messages).toContain('旅行商人只在週五、週六的鎮廣場出現');
  });

  it('不在櫃檯前面就買不到（和一般商店一樣）', () => {
    const out = run(onDay(5, { player: { x: 1, y: 3, facing: 'up' } }), buy('star-string'));
    expect(out.messages).toContain('要站在櫃檯前面才能買');
    expect(out.state.gold).toBe(1000);
  });

  it('貨架上沒有的東西買不到', () => {
    const out = run(onDay(5), buy('hay'));
    expect(out.messages).toContain('這裡沒有賣這個');
  });

  it('金幣不夠就不買', () => {
    const out = run(onDay(5, { gold: 100 }), buy('star-string'));
    expect(out.messages).toContain('金幣不夠');
    expect(countOf(out.state.inventory, 'star-string')).toBe(0);
  });

  it('背包放不下就不買，金幣不扣', () => {
    let full = createInventory(1);
    const added = addItem(full, index.item('hay'), 1);
    if (!added.ok) throw new Error('背包放不下');
    full = added.value;
    const out = run(onDay(5, { inventory: full }), buy('star-string'));
    expect(out.messages).toContain('背包已滿');
    expect(out.state.gold).toBe(1000);
  });
});

describe('每週每件的購買上限', () => {
  it('同一件最多買兩個；第三個被拒絕，金幣不變', () => {
    let state = onDay(5);
    state = run(state, buy('star-string', 2)).state;
    expect(countOf(state.inventory, 'star-string')).toBe(2);
    const out = run(state, buy('star-string'));
    expect(out.messages).toContain('旅行商人這週已經賣給你這件的上限了');
    expect(out.state.gold).toBe(state.gold);
  });

  it('上限是整週的：週五買了，週六還是買不了', () => {
    const friday = run(onDay(5), buy('star-string', 2)).state;
    const saturday = run({ ...friday, calendar: { ...friday.calendar, day: 6 } }, buy('star-string'));
    expect(saturday.messages).toContain('旅行商人這週已經賣給你這件的上限了');
  });

  it('下週重新計算：下週五又能買', () => {
    const friday = run(onDay(5), buy('star-string', 2)).state;
    const nextFriday = run({ ...friday, calendar: { ...friday.calendar, day: 12 } }, buy('star-string'));
    expect(countOf(nextFriday.state.inventory, 'star-string')).toBe(3);
    expect(nextFriday.state.merchant.week).toBe(8);
  });

  it('不同的東西各有各的上限', () => {
    const state = run(onDay(5, { gold: 2000 }), buy('star-string', 2)).state;
    const out = run(state, buy('night-canvas', 2));
    expect(countOf(out.state.inventory, 'night-canvas')).toBe(2);
  });
});
