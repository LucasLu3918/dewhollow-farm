import { describe, expect, it } from 'vitest';
import mineRulesJson from '../../content/mine.json';
import type { ContentPack } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { addItem, createInventory } from '../domain/inventory';
import { weekStartOf } from '../domain/traveling-merchant';
import { createContentIndex, type ContentIndex } from './content-index';
import { buyRefusal, missingMaterials, upgradeRefusal } from './purchase-check';

/**
 * 購買與升級的「能不能」判斷（純函式，不含站位）：貨架、季節、金幣、材料、背包、
 * 旅行商人的週限額，以及工具的階級。buy()、upgrade() 與商店面板共用這一組判斷。
 */
const content: ContentPack = {
  crops: [{ id: 'sweet-radish', name: '甜蘿蔔', seedPrice: 20, growthDays: 2, seasons: ['spring'] }],
  npcs: [],
  schedule: { periods: { noon: 720, evening: 1020 }, entries: [] },
  heartEvents: [],
  friendship: { pointsPerHeart: 100, maxHearts: 10, earlyCap: { hearts: 4, untilSeason: 'summer' }, talkPoints: 10, gift: { love: 80, neutral: 30, hate: -40 }, cropQuality: { minHearts: 2, perResident: 0.05, cap: 0.15 } },
  crafting: [],
  talents: { unlockLevel: 5, defs: [] },
  mine: mineRulesJson,
  processing: [],
  recipes: [],
  animals: [],
  fish: [],
  items: [
    { id: 'wood', name: '木材', kind: 'material', maxStack: 99, sellPrice: 6 },
    { id: 'mint', name: '野薄荷', kind: 'forage', maxStack: 99, sellPrice: 14 },
    { id: 'copper-ore', name: '銅礦石', kind: 'ore', maxStack: 99, sellPrice: 20 },
    { id: 'star-string', name: '星空燈串', kind: 'decor', maxStack: 20 },
  ],
  shops: [
    {
      id: 'general',
      name: '雜貨店',
      stock: [
        { itemId: 'wood', price: 5 },
        { itemId: 'copper-ore', price: 40, seasons: ['autumn'] },
      ],
      upgrades: [],
    },
    {
      id: 'smithy',
      name: '鐵匠',
      stock: [],
      upgrades: [
        { toolId: 'hoe', tier: 1, gold: 300, items: { wood: 10 } },
        { toolId: 'hoe', tier: 2, gold: 800, items: { 'copper-ore': 5, wood: 20 } },
      ],
    },
    { id: 'traveling-merchant', name: '旅行商人', stock: [], upgrades: [], rotating: true },
  ],
  merchant: {
    weekdays: [4, 5],
    slots: { min: 2, max: 2 },
    perItemWeekly: 2,
    playMinutes: 2,
    candidates: [{ itemId: 'star-string', price: 260 }],
  },
  start: { mapId: 'yard', gold: 400, seeds: { 'sweet-radish': 2 } },
  tuning: {
    energy: { max: 20, costs: { till: 2, water: 1, plant: 1, harvest: 1, ship: 0, chop: 3, forage: 1, mine: 2, fish: 2, cook: 1, process: 1 } },
    inventory: { capacity: 8 },
    harvest: { min: 1, max: 5 },
    time: { wakeMinute: 360, minutesPerAction: 10, daysPerSeason: 20 },
    tools: { tiers: [{ energyDiscount: 0 }, { energyDiscount: 1 }, { energyDiscount: 1 }, { energyDiscount: 2 }] },
    fishing: { biteChance: 60, bobberBonus: 10, baitBonus: 20 },
    fertilizer: { basic: { goodBonus: 20, fineBonus: 0 }, fine: { goodBonus: 30, fineBonus: 15 } },
    processing: { slots: 3 },
    skills: { thresholds: [0, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650], xp: { till: 2, water: 1, plant: 2, harvest: 4, chop: 4, forage: 3, mine: 4 }, bonusFrom: 5, goodFrom: 4, goodChance: 0.2, fineFrom: 8, fineChance: 0.08 },
    gathering: { wood: { min: 1, max: 3 }, forage: { min: 1, max: 2 }, stone: { min: 1, max: 2 }, ore: { min: 1, max: 2 } },
  },
  weather: {
    spring: [{ weather: 'sunny', weight: 1 }],
    summer: [{ weather: 'sunny', weight: 1 }],
    autumn: [{ weather: 'sunny', weight: 1 }],
    winter: [{ weather: 'snow', weight: 1 }],
  },
  maps: [
    {
      id: 'yard',
      name: '院子',
      width: 5,
      height: 4,
      rows: ['#####', '.T.H.', '..Q.I', 'B.ff.'],
      legend: {
        '#': { kind: 'wall' },
        '.': { kind: 'grass' },
        T: { kind: 'tree' },
        H: { kind: 'forage' },
        Q: { kind: 'shop', shop: 'general' },
        I: { kind: 'shop', shop: 'smithy' },
        B: { kind: 'bed' },
        f: { kind: 'field' },
      },
      spawn: { x: 1, y: 2 },
    },
  ],
};

const index: ContentIndex = createContentIndex(content);

/** 春季第 5 天是週五（旅行商人來訪）；第 1 天是週一。 */
const FRIDAY = { year: 1, season: 'spring' as const, day: 5, minuteOfDay: 600 };

function fresh(overrides: Partial<GameState> = {}): GameState {
  return { ...createNewGame(content, 7), mapId: 'yard', toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 }, ...overrides };
}

/** 背包裡放進指定的物品（之後的購買、升級要用）。 */
function withItems(state: GameState, counts: Record<string, number>, capacity = 8): GameState {
  let inventory = createInventory(capacity);
  for (const [id, count] of Object.entries(counts)) {
    const added = addItem(inventory, index.item(id), count);
    if (!added.ok) throw new Error(`背包放不下 ${id}`);
    inventory = added.value;
  }
  return { ...state, inventory };
}

describe('buyRefusal：一般貨架', () => {
  it('金幣夠、背包放得下：回傳 null（可以買）', () => {
    expect(buyRefusal(fresh(), index, 'general', 'wood', 2)).toBeNull();
  });

  it('金幣不足：NO_GOLD', () => {
    expect(buyRefusal(fresh({ gold: 4 }), index, 'general', 'wood', 1)).toBe('NO_GOLD');
  });

  it('貨架上沒有這一項：NOT_SOLD', () => {
    expect(buyRefusal(fresh(), index, 'general', 'mint', 1)).toBe('NOT_SOLD');
  });

  it('這個季節沒有進貨（季節下架）：NOT_IN_STOCK_SEASON', () => {
    expect(buyRefusal(fresh(), index, 'general', 'copper-ore', 1)).toBe('NOT_IN_STOCK_SEASON');
  });

  it('背包沒有空格：BAG_FULL', () => {
    const full = withItems(fresh(), { mint: 1 }, 1);
    expect(buyRefusal(full, index, 'general', 'wood', 1)).toBe('BAG_FULL');
  });
});

describe('buyRefusal：旅行商人', () => {
  const friday = (state: GameState): GameState => ({ ...state, calendar: FRIDAY });

  it('週五、金幣夠：回傳 null', () => {
    expect(buyRefusal(friday(fresh()), index, 'traveling-merchant', 'star-string', 1)).toBeNull();
  });

  it('本週已經買到上限：MERCHANT_LIMIT（上限是整週的）', () => {
    const week = weekStartOf(FRIDAY, index.tuning.time.daysPerSeason);
    const bought = friday(fresh({ merchant: { week, bought: { 'star-string': 2 } } }));
    expect(buyRefusal(bought, index, 'traveling-merchant', 'star-string', 1)).toBe('MERCHANT_LIMIT');
  });

  it('上週買過的不算：換週後數量歸零，回傳 null', () => {
    const lastWeek = friday(fresh({ merchant: { week: 1 - 7, bought: { 'star-string': 2 } } }));
    expect(buyRefusal(lastWeek, index, 'traveling-merchant', 'star-string', 1)).toBeNull();
  });

  it('不是週五、週六：MERCHANT_AWAY', () => {
    const monday = fresh({ calendar: { ...FRIDAY, day: 1 } });
    expect(buyRefusal(monday, index, 'traveling-merchant', 'star-string', 1)).toBe('MERCHANT_AWAY');
  });

  it('金幣不足：NO_GOLD', () => {
    expect(buyRefusal(friday(fresh({ gold: 100 })), index, 'traveling-merchant', 'star-string', 1)).toBe('NO_GOLD');
  });
});

describe('upgradeRefusal：鐵匠', () => {
  it('金幣與材料都夠：回傳 null（可以升級）', () => {
    const ready = withItems(fresh(), { wood: 10 });
    expect(upgradeRefusal(ready, index, 'smithy', 'hoe')).toBeNull();
  });

  it('金幣不足：NO_GOLD（一階 300 金）', () => {
    const poor = withItems(fresh({ gold: 100 }), { wood: 10 });
    expect(upgradeRefusal(poor, index, 'smithy', 'hoe')).toBe('NO_GOLD');
  });

  it('材料不足：NO_MATERIAL，缺的材料列得出來', () => {
    const noWood = fresh();
    expect(upgradeRefusal(noWood, index, 'smithy', 'hoe')).toBe('NO_MATERIAL');
    expect(missingMaterials(noWood, index, { wood: 10 })).toEqual(['木材 × 10']);
  });

  it('材料只缺一部分：缺的那一項照數算', () => {
    const partial = withItems(fresh({ toolTiers: { hoe: 1, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 }, gold: 2000 }), { wood: 20 });
    expect(upgradeRefusal(partial, index, 'smithy', 'hoe')).toBe('NO_MATERIAL');
    expect(missingMaterials(partial, index, { 'copper-ore': 5, wood: 20 })).toEqual(['銅礦石 × 5']);
  });

  it('工具已經是最高階：TIER_MAX', () => {
    const top = withItems(fresh({ gold: 9999, toolTiers: { hoe: 3, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 } }), { wood: 50, 'copper-ore': 50 });
    expect(upgradeRefusal(top, index, 'smithy', 'hoe')).toBe('TIER_MAX');
  });

  it('工具的下一階鐵匠沒有賣：NOT_FOR_SALE（這裡只有鋤頭的升級）', () => {
    const can = withItems(fresh({ gold: 9999 }), { wood: 50 });
    expect(upgradeRefusal(can, index, 'smithy', 'can')).toBe('NOT_FOR_SALE');
  });
});
