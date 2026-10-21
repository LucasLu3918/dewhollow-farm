import { describe, expect, it } from 'vitest';
import type { ContentPack } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { plotKey } from '../domain/farm';
import { countOf, createInventory, type Inventory } from '../domain/inventory';
import type { ItemStack } from '../domain/items';
import { rollInt } from '../domain/random';
import { priceWithQuality, sellPriceOf } from '../domain/pricing';
import { executeCommand } from './game-commands';
import { createContentIndex } from './content-index';

/** 測試用的小型內容：農場與村莊各一張，足以覆蓋各種操作。 */
const content: ContentPack = {
  crops: [
    { id: 'sweet-radish', name: '甜蘿蔔', seedPrice: 20, growthDays: 2, seasons: ['spring', 'summer'] },
    { id: 'moon-bean', name: '月光豆', seedPrice: 35, growthDays: 4, seasons: ['spring'] },
  ],
  npcs: [{ id: 'mira', name: '米拉', lines: ['早安。', '今天也辛苦了。'], gift: { cropId: 'sweet-radish', count: 3 } }],
  start: { mapId: 'farm', gold: 100, seeds: { 'sweet-radish': 5 } },
  tuning: {
    energy: { max: 20, costs: { till: 2, water: 1, plant: 1, harvest: 1, ship: 0, chop: 3, forage: 1, mine: 2, fish: 2, cook: 1, process: 1 } },
    inventory: { capacity: 4 },
    harvest: { min: 1, max: 5 },
    time: { wakeMinute: 360, minutesPerAction: 10, daysPerSeason: 20 },
    tools: { tiers: [{ energyDiscount: 0 }, { energyDiscount: 1 }, { energyDiscount: 1 }, { energyDiscount: 2 }] },
    fishing: { biteChance: 60, bobberBonus: 10, baitBonus: 20 },
    fertilizer: { basic: { goodBonus: 20, fineBonus: 0 }, fine: { goodBonus: 30, fineBonus: 15 } },
    processing: { slots: 3 },
    skills: { thresholds: [0, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650], xp: { till: 2, water: 1, plant: 2, harvest: 4, chop: 4, forage: 3, mine: 4 }, bonusFrom: 5, goodFrom: 4, goodChance: 0.2, fineFrom: 8, fineChance: 0.08 },
    gathering: { wood: { min: 1, max: 3 }, forage: { min: 1, max: 2 }, stone: { min: 1, max: 2 }, ore: { min: 1, max: 2 } },
  },
  crafting: [],
  processing: [],
  recipes: [],
  animals: [],
  fish: [],
  items: [],
  shops: [],
  weather: {
    spring: [{ weather: 'sunny', weight: 1 }],
    summer: [{ weather: 'sunny', weight: 1 }],
    autumn: [{ weather: 'sunny', weight: 1 }],
    winter: [{ weather: 'snow', weight: 1 }],
  },
  maps: [
    {
      id: 'farm',
      name: '農場',
      width: 5,
      height: 3,
      //        0123 4
      rows: ['#####', '.ff.B', '.S.D.'],
      legend: {
        '#': { kind: 'wall' },
        '.': { kind: 'grass' },
        f: { kind: 'field' },
        B: { kind: 'bed' },
        S: { kind: 'shipbox' },
        D: { kind: 'door', to: 'village', spawn: { x: 1, y: 1 } },
      },
      spawn: { x: 3, y: 1 },
      npcs: [],
    },
    {
      id: 'mine',
      name: '礦坑入口',
      width: 3,
      height: 2,
      rows: ['#C#', '...'],
      legend: { '#': { kind: 'wall' }, C: { kind: 'cave' }, '.': { kind: 'path' } },
      spawn: { x: 1, y: 1 },
      npcs: [],
    },
    {
      id: 'village',
      name: '村莊',
      width: 3,
      height: 3,
      rows: ['.M.', '...', '#D#'],
      legend: {
        '#': { kind: 'wall' },
        '.': { kind: 'grass' },
        M: { kind: 'grass' },
        D: { kind: 'door', to: 'farm', spawn: { x: 3, y: 1 } },
      },
      spawn: { x: 1, y: 1 },
      npcs: [{ npcId: 'mira', x: 1, y: 0 }],
    },
  ],
};

const index = createContentIndex(content);

/** 田地 (2,1)：玩家站在 (3,1) 面向左側即可互動。 */
const FIELD = plotKey(2, 1);
const FIELD_SIDE = { x: 3, y: 1, facing: 'left' as const };
/** 出貨箱 (1,2)：玩家站在 (2,2) 面向左側。 */
const SHIP_SIDE = { x: 2, y: 2, facing: 'left' as const };
/** 床 (4,1)：玩家站在 (3,1) 面向右側。 */
const BED_SIDE = { x: 3, y: 1, facing: 'right' as const };

function start(overrides: Partial<GameState> = {}): GameState {
  return { ...createNewGame(content, 1), ...overrides };
}

/** 組出指定內容的背包（容量沿用內容設定，可覆寫）。 */
function bagOf(stacks: ItemStack[], capacity = 4): Inventory {
  return { ...createInventory(capacity), stacks };
}

function crops(cropId: string, count: number, quality: ItemStack['quality'] = 'normal'): ItemStack {
  return { itemId: `crop.${cropId}`, quality, count };
}

function at(state: GameState, player: GameState['player']): GameState {
  return { ...state, player };
}

function act(state: GameState): GameState {
  return executeCommand(state, { type: 'interact' }, index).state;
}

function sleep(state: GameState): GameState {
  return executeCommand(at(state, BED_SIDE), { type: 'interact' }, index).state;
}

describe('movement', () => {
  it('moving into a wall only changes facing', () => {
    const state = at(start(), { x: 1, y: 1, facing: 'down' });
    const out = executeCommand(state, { type: 'move', direction: 'up' }, index);
    expect(out.state.player).toEqual({ x: 1, y: 1, facing: 'up' });
  });

  it('moves one tile into open ground', () => {
    const state = at(start(), { x: 3, y: 1, facing: 'down' });
    const out = executeCommand(state, { type: 'move', direction: 'left' }, index);
    expect(out.state.player).toEqual({ x: 2, y: 1, facing: 'left' });
  });

  it('walking into a door changes map and lands on the spawn tile', () => {
    const state = at(start(), { x: 3, y: 1, facing: 'down' });
    const out = executeCommand(state, { type: 'move', direction: 'down' }, index);
    expect(out.state.mapId).toBe('village');
    expect(out.state.player).toMatchObject({ x: 1, y: 1 });
    expect(out.events).toContainEqual({ type: 'enteredMap', mapId: 'village' });
  });
});

describe('farming actions', () => {
  it('tills a field with the hoe, costs energy and time', () => {
    const state = at(start(), FIELD_SIDE);
    const out = executeCommand(state, { type: 'interact' }, index);
    expect(out.state.plots[FIELD]).toEqual({ watered: false, dryDays: 0, crop: null });
    expect(out.state.energy.current).toBe(state.energy.current - 2);
    expect(out.state.calendar.minuteOfDay).toBe(state.calendar.minuteOfDay + 10);
  });

  it('leaves the state untouched when energy is not enough', () => {
    const state = at(start({ energy: { current: 1, max: 20 } }), FIELD_SIDE);
    const out = executeCommand(state, { type: 'interact' }, index);
    expect(out.state).toEqual(state);
    expect(out.messages).toEqual(['體力不足，請回家睡覺']);
  });

  it('plants, waters, grows overnight, and refuses to plant twice', () => {
    let state = at(start(), FIELD_SIDE);
    state = act(state); // 開墾（鋤頭）
    state = executeCommand(state, { type: 'cycleTool' }, index).state; // 水壺
    state = executeCommand(state, { type: 'cycleTool' }, index).state; // 種子袋
    state = act(state); // 播種
    expect(state.plots[FIELD]?.crop).toEqual({ cropId: 'sweet-radish', growthDays: 0 });
    expect(countOf(state.inventory, 'seed.sweet-radish')).toBe(4);

    state = executeCommand(state, { type: 'cycleTool' }, index).state; // 鋤頭
    state = executeCommand(state, { type: 'cycleTool' }, index).state; // 水壺
    state = act(state); // 澆水
    expect(state.plots[FIELD]?.watered).toBe(true);

    state = sleep(state);
    expect(state.plots[FIELD]?.crop?.growthDays).toBe(1);
    expect(state.plots[FIELD]?.watered).toBe(false);

    state = executeCommand(state, { type: 'cycleTool' }, index).state; // 種子袋
    const again = executeCommand(at(state, FIELD_SIDE), { type: 'interact' }, index);
    expect(again.messages).toEqual(['這塊田已經種了作物']);
    expect(countOf(again.state.inventory, 'seed.sweet-radish')).toBe(4);
  });

  it('does not grow an unwatered crop overnight', () => {
    const planted = start({
      plots: { [FIELD]: { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 0 } } },
    });
    expect(sleep(planted).plots[FIELD]?.crop?.growthDays).toBe(0);
  });

  it('harvests a ripe crop into the bag with any tool', () => {
    const ripe = start({
      plots: { [FIELD]: { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 2 } } },
    });
    const out = executeCommand(at(ripe, FIELD_SIDE), { type: 'interact' }, index);
    expect(out.state.plots[FIELD]?.crop).toBeNull();
    const expected = rollInt(ripe.rng, 1, 5).value;
    expect(countOf(out.state.inventory, 'crop.sweet-radish')).toBe(expected);
    expect(out.messages).toEqual([`收成了 甜蘿蔔 × ${expected}`]);
  });

  it('refuses to harvest when the bag is full and keeps the crop in the ground', () => {
    const ripe = start({
      inventory: bagOf([{ itemId: 'seed.moon-bean', quality: 'normal', count: 1 }], 1),
      plots: { [FIELD]: { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 2 } } },
    });
    const state = at(ripe, FIELD_SIDE);
    const out = executeCommand(state, { type: 'interact' }, index);
    expect(out.messages).toEqual(['背包已滿']);
    expect(out.state).toEqual(state);
    expect(out.events).toEqual([{ type: 'refused', reason: 'BAG_FULL' }]); // 只有「被拒絕」的提示，沒有任何動作回饋
  });

  it('yields between 1 and 5 crops and advances the random state', () => {
    const ripe = start({
      plots: { [FIELD]: { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 3 } } },
    });
    const out = executeCommand(at(ripe, FIELD_SIDE), { type: 'interact' }, index);
    const count = countOf(out.state.inventory, 'crop.sweet-radish');
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(5);
    expect(out.state.rng).not.toBe(ripe.rng);
  });

  it('withers an unwatered crop on the second night and reports it', () => {
    const planted = start({
      plots: { [FIELD]: { watered: false, dryDays: 1, crop: { cropId: 'sweet-radish', growthDays: 1 } } },
    });
    const slept = sleep(planted);
    expect(slept.plots[FIELD]?.crop).toBeNull();
    const out = executeCommand(at(planted, BED_SIDE), { type: 'interact' }, index);
    expect(out.messages).toContain('缺水，甜蘿蔔 枯死了');
  });
});

describe('action feedback', () => {
  it('emits an acted event with the tile when tilling succeeds', () => {
    const out = executeCommand(at(start(), FIELD_SIDE), { type: 'interact' }, index);
    expect(out.events).toContainEqual({ type: 'acted', action: 'till', x: 2, y: 1 });
  });

  it('emits no acted event when the action fails', () => {
    const state = at(start({ energy: { current: 0, max: 20 } }), FIELD_SIDE);
    const out = executeCommand(state, { type: 'interact' }, index);
    expect(out.events.some((e) => e.type === 'acted')).toBe(false);
  });

  it('emits an acted event at the shipping box when shipping', () => {
    const state = at(start({ inventory: bagOf([crops('sweet-radish', 1)]) }), SHIP_SIDE);
    const out = executeCommand(state, { type: 'interact' }, index);
    expect(out.events).toContainEqual({ type: 'acted', action: 'ship', x: 1, y: 2 });
  });
});

describe('shipping and sleep', () => {
  it('ships crops from the bag and pays out after sleeping', () => {
    const state = at(start({ inventory: bagOf([crops('sweet-radish', 2)]) }), SHIP_SIDE);
    const shipped = act(state);
    expect(shipped.inventory.stacks).toEqual([]);
    expect(shipped.shipBox.entries).toEqual([crops('sweet-radish', 2)]);

    const slept = sleep(shipped);
    expect(slept.gold).toBe(100 + 2 * sellPriceOf(20, 2)); // 甜蘿蔔：20 × 3 × 1.2 = 72
    expect(slept.shipBox.entries).toEqual([]);
    expect(slept.calendar.day).toBe(2);
    expect(slept.energy.current).toBe(20);
  });

  it('ships only sellable items and keeps the seeds in the bag', () => {
    const state = at(
      start({ inventory: bagOf([{ itemId: 'seed.sweet-radish', quality: 'normal', count: 5 }, crops('moon-bean', 1)]) }),
      SHIP_SIDE,
    );
    const shipped = act(state);
    expect(shipped.inventory.stacks).toEqual([{ itemId: 'seed.sweet-radish', quality: 'normal', count: 5 }]);
    expect(shipped.shipBox.entries).toEqual([crops('moon-bean', 1)]);
  });

  it('pays more for higher quality produce', () => {
    const state = at(start({ inventory: bagOf([crops('sweet-radish', 2, 'fine')]) }), SHIP_SIDE);
    const slept = sleep(act(state));
    expect(slept.gold).toBe(100 + 2 * priceWithQuality(sellPriceOf(20, 2), 'fine'));
  });

  it('reports nothing to ship when the bag holds only seeds', () => {
    const out = executeCommand(at(start(), SHIP_SIDE), { type: 'interact' }, index);
    expect(out.messages).toEqual(['背包裡沒有可出貨的作物']);
    expect(out.state).toEqual(at(start(), SHIP_SIDE));
  });

  it('reports nothing to ship when the bag has no crops', () => {
    const out = executeCommand(at(start(), SHIP_SIDE), { type: 'interact' }, index);
    expect(out.messages).toEqual(['背包裡沒有可出貨的作物']);
  });

  it('emits a slept event when the player sleeps in bed', () => {
    const out = executeCommand(at(start(), BED_SIDE), { type: 'interact' }, index);
    expect(out.events).toContainEqual({ type: 'slept' });
  });
});

describe('villagers', () => {
  it('gives the gift once and then repeats only the last line', () => {
    const village = at({ ...start(), mapId: 'village' }, { x: 1, y: 1, facing: 'up' });
    const first = executeCommand(village, { type: 'interact' }, index);
    expect(countOf(first.state.inventory, 'seed.sweet-radish')).toBe(5 + 3);
    expect(first.state.flags['talked:mira']).toBe(true);
    expect(first.messages).toEqual(['早安。', '今天也辛苦了。', '獲得 甜蘿蔔種子 × 3']);

    const second = executeCommand(first.state, { type: 'interact' }, index);
    expect(countOf(second.state.inventory, 'seed.sweet-radish')).toBe(8);
    expect(second.messages).toEqual(['今天也辛苦了。']);
  });
});

describe('refused actions emit an event, so the player can see why nothing happened', () => {
  const reasonOf = (state: GameState): string | undefined => {
    const out = executeCommand(state, { type: 'interact' }, index);
    return out.events.find((e): e is Extract<typeof e, { type: 'refused' }> => e.type === 'refused')?.reason;
  };

  it('says there is no energy left', () => {
    expect(reasonOf(at(start({ energy: { current: 0, max: 20 } }), FIELD_SIDE))).toBe('NOT_ENOUGH_ENERGY');
  });

  it('says there is nothing to interact with', () => {
    const wall = at(start(), { x: 1, y: 1, facing: 'up' });
    expect(reasonOf(wall)).toBe('NOTHING_HERE');
  });

  it('says the soil has not been tilled when watering bare ground', () => {
    expect(reasonOf(at(start({ tool: 'can' }), FIELD_SIDE))).toBe('NO_SOIL');
  });

  it('says the plot is already planted', () => {
    const planted = start({
      tool: 'seedbag',
      plots: { [FIELD]: { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 0 } } },
    });
    expect(reasonOf(at(planted, FIELD_SIDE))).toBe('ALREADY_PLANTED');
  });

  it('says there is nothing to ship', () => {
    expect(reasonOf(at(start(), SHIP_SIDE))).toBe('NO_SHIPPABLE');
  });

  it('says the bag is full when a harvest does not fit', () => {
    const ripe = start({
      inventory: bagOf([{ itemId: 'seed.moon-bean', quality: 'normal', count: 1 }], 1),
      plots: { [FIELD]: { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 2 } } },
    });
    expect(reasonOf(at(ripe, FIELD_SIDE))).toBe('BAG_FULL');
  });

  it('does not say anything when the action worked', () => {
    expect(executeCommand(at(start(), FIELD_SIDE), { type: 'interact' }, index).events.some((e) => e.type === 'refused')).toBe(false);
  });

  it('never refuses and acts at the same time', () => {
    const out = executeCommand(at(start({ energy: { current: 0, max: 20 } }), FIELD_SIDE), { type: 'interact' }, index);
    expect(out.events.some((e) => e.type === 'acted')).toBe(false);
  });
});

describe('talking emits an event for the presentation', () => {
  it('says which villager was talked to, on the first and on later talks', () => {
    const village = at({ ...start(), mapId: 'village' }, { x: 1, y: 1, facing: 'up' });
    const first = executeCommand(village, { type: 'interact' }, index);
    expect(first.events).toContainEqual({ type: 'talked', npcId: 'mira', first: true, gifted: true });
    const second = executeCommand(first.state, { type: 'interact' }, index);
    expect(second.events).toContainEqual({ type: 'talked', npcId: 'mira', first: false, gifted: false });
  });

  it('still says so when the gift did not fit in the bag', () => {
    const full = bagOf([{ itemId: 'crop.moon-bean', quality: 'normal', count: 1 }], 1);
    const village = at({ ...start({ inventory: full }), mapId: 'village' }, { x: 1, y: 1, facing: 'up' });
    expect(executeCommand(village, { type: 'interact' }, index).events).toContainEqual({
      type: 'talked',
      npcId: 'mira',
      first: true,
      gifted: false,
    });
  });

  it('does not emit it when nothing was talked to', () => {
    const out = executeCommand(at(start(), FIELD_SIDE), { type: 'interact' }, index);
    expect(out.events.some((e) => e.type === 'talked')).toBe(false);
  });
});

describe('villager gift with a full bag', () => {
  it('keeps the gift for later instead of losing it', () => {
    const full = bagOf([{ itemId: 'crop.moon-bean', quality: 'normal', count: 1 }], 1);
    const village = at({ ...start({ inventory: full }), mapId: 'village' }, { x: 1, y: 1, facing: 'up' });
    const out = executeCommand(village, { type: 'interact' }, index);
    expect(out.messages).toContain('背包已滿，先整理一下再來領禮物');
    expect(out.state.flags['talked:mira']).toBeUndefined();
    expect(out.state.inventory).toEqual(full);
  });
});

describe('tools and seeds', () => {
  it('cycles tools in order', () => {
    let state = start();
    const seen: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      state = executeCommand(state, { type: 'cycleTool' }, index).state;
      seen.push(state.tool);
    }
    expect(seen).toEqual(['can', 'seedbag', 'hoe', 'can']);
  });

  it('cycles the selected seed through the crop list', () => {
    let state = start();
    state = executeCommand(state, { type: 'cycleSeed' }, index).state;
    expect(state.selectedSeed).toBe('moon-bean');
    state = executeCommand(state, { type: 'cycleSeed' }, index).state;
    expect(state.selectedSeed).toBe('sweet-radish');
  });
});

describe('seasons and weather', () => {
  const FIELD_SEED = (state: GameState): GameState => ({
    ...state,
    tool: 'seedbag',
    plots: { [FIELD]: { watered: false, crop: null, dryDays: 0 } },
  });

  it('refuses to plant a crop out of its season and keeps the seed', () => {
    const state = at(
      FIELD_SEED(start({ calendar: { year: 1, season: 'winter', day: 1, minuteOfDay: 360 }, selectedSeed: 'sweet-radish' })),
      FIELD_SIDE,
    );
    const out = executeCommand(state, { type: 'interact' }, index);
    expect(out.state.plots[FIELD]?.crop).toBeNull();
    expect(out.state.inventory).toEqual(state.inventory);
    expect(out.messages).toContain('這個季節種不了這種作物');
    expect(out.events).toContainEqual({ type: 'refused', reason: 'NOT_IN_SEASON' });
  });

  it('plants the same crop in its own season', () => {
    const state = at(FIELD_SEED(start({ selectedSeed: 'sweet-radish' })), FIELD_SIDE);
    expect(act(state).plots[FIELD]?.crop?.cropId).toBe('sweet-radish');
  });

  it('a rainy night waters every field, so an unwatered crop still grows', () => {
    const planted = start({ weather: 'rain', plots: { [FIELD]: { watered: false, crop: { cropId: 'sweet-radish', growthDays: 0 }, dryDays: 0 } } });
    const slept = sleep(planted);
    expect(slept.plots[FIELD]?.crop?.growthDays).toBe(1);
    expect(slept.plots[FIELD]?.dryDays).toBe(0);
  });

  it('a sunny night does not water: the unwatered crop goes a day without water', () => {
    const planted = start({ weather: 'sunny', plots: { [FIELD]: { watered: false, crop: { cropId: 'sweet-radish', growthDays: 1 }, dryDays: 0 } } });
    const slept = sleep(planted);
    expect(slept.plots[FIELD]?.crop?.growthDays).toBe(0);
    expect(slept.plots[FIELD]?.dryDays).toBe(1);
  });

  it('when the season changes, a crop that does not grow in the new season withers, with a message', () => {
    const state = start({
      calendar: { year: 1, season: 'spring', day: 20, minuteOfDay: 1200 },
      plots: { [FIELD]: { watered: true, crop: { cropId: 'moon-bean', growthDays: 1 }, dryDays: 0 } },
    });
    const out = executeCommand(at(state, BED_SIDE), { type: 'interact' }, index);
    expect(out.state.calendar).toMatchObject({ season: 'summer', day: 1 });
    expect(out.state.plots[FIELD]?.crop).toBeNull();
    expect(out.messages.join('\n')).toContain('月光豆');
    expect(out.messages.join('\n')).toContain('換季');
  });

  it('a crop that grows in both seasons survives the change', () => {
    const state = start({
      calendar: { year: 1, season: 'spring', day: 20, minuteOfDay: 1200 },
      plots: { [FIELD]: { watered: true, crop: { cropId: 'sweet-radish', growthDays: 1 }, dryDays: 0 } },
    });
    expect(sleep(state).plots[FIELD]?.crop?.cropId).toBe('sweet-radish');
  });

  it('tomorrow\'s forecast becomes today\'s weather, and a new forecast is drawn for the day after', () => {
    const slept = sleep(start({ weather: 'sunny', forecast: 'rain' }));
    expect(slept.weather).toBe('rain');
    expect(slept.forecast).toBe('sunny');
  });
});

describe('the mine entrance (M3: the mine is not open yet)', () => {
  it('a fallen rock blocks the cave: interacting refuses without spending energy or time', () => {
    const state = at(start({ mapId: 'mine' }), { x: 1, y: 1, facing: 'up' });
    const out = executeCommand(state, { type: 'interact' }, index);
    expect(out.messages).toContain('落石擋住了礦坑入口，要用鎬才清得開');
    expect(out.events).toContainEqual({ type: 'refused', reason: 'MINE_LOCKED' });
    expect(out.state.energy).toEqual(state.energy);
    expect(out.state.calendar).toEqual(state.calendar);
  });
});

