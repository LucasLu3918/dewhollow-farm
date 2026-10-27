import { describe, expect, it } from 'vitest';
import { createNewGame, type GameState } from '../domain/game-state';
import type { Calendar } from '../domain/calendar';
import { totalDay } from '../domain/calendar';
import { addItem, countOf, createInventory } from '../domain/inventory';
import { plotKey, type PlotMap } from '../domain/farm';
import { shippedIndex, shippedPack } from '../../tests/sim/shipped-content';
import { executeCommand, type Command, type CommandOutcome } from './game-commands';

/**
 * M6：秋冬內容。豐穗祭（秋 12）、暖燈節（冬 20）、溫室（冬季種植、換季不枯死）、雜貨店的季節進貨、
 * 主線第 4–5 章。使用真實內容（tests/sim/shipped-content.ts）。
 */

function at(season: Calendar['season'], day: number, minuteOfDay: number, year = 1): Calendar {
  return { year, season, day, minuteOfDay };
}

/** 晴天、今天與明天都是晴，行程才固定（雨天居民會留在村子）。 */
function game(overrides: Partial<GameState>): GameState {
  return { ...createNewGame(shippedPack, 7), weather: 'sunny', forecast: 'sunny', ...overrides };
}

function run(state: GameState, command: Command): CommandOutcome {
  return executeCommand(state, command, shippedIndex);
}

function addTo(state: GameState, items: Record<string, number>): GameState {
  let inventory = state.inventory;
  for (const [itemId, count] of Object.entries(items)) {
    const stored = addItem(inventory, shippedIndex.item(itemId), count);
    if (!stored.ok) throw new Error(`背包放不下 ${itemId}`);
    inventory = stored.value;
  }
  return { ...state, inventory };
}

function withItems(state: GameState, items: Record<string, number>): GameState {
  return addTo({ ...state, inventory: createInventory(60) }, items);
}

/** 一塊已開墾的田（可指定作物與是否澆水）。 */
function plot(crop: string | null, growthDays = 0, watered = true): PlotMap[string] {
  return { watered, crop: crop === null ? null : { cropId: crop, growthDays }, dryDays: 0 };
}

const AUTUMN_FEAST = { calendar: at('autumn', 12, 720), mapId: 'plaza' };
const WARM_NIGHT = { calendar: at('winter', 20, 1100), mapId: 'plaza' };

describe('豐穗祭：作物交換', () => {
  it('在秋 12 的鎮廣場、居民在場，用作物換到秋季的種子，每人每年一次，並算參加豐穗祭', () => {
    const start = withItems(game({ ...AUTUMN_FEAST }), { 'crop.maple-berry': 2 });
    const out = run(start, { type: 'festivalSwap', npcId: 'maomao' });
    expect(countOf(out.state.inventory, 'crop.maple-berry')).toBe(0);
    expect(countOf(out.state.inventory, 'seed.golden-rice')).toBe(2);
    expect(out.state.festival.done['harvest-feast:swap:maomao']).toBe(1);
    expect(out.state.flags['attended:harvest-feast']).toBe(true);

    const again = run(addTo(out.state, { 'crop.maple-berry': 2 }), { type: 'festivalSwap', npcId: 'maomao' });
    expect(again.events).toContainEqual({ type: 'refused', reason: 'ALREADY_THIS_YEAR' });
  });

  it('不是秋 12 就不能換', () => {
    const start = withItems(game({ calendar: at('autumn', 11, 720), mapId: 'plaza' }), { 'crop.maple-berry': 2 });
    expect(run(start, { type: 'festivalSwap', npcId: 'maomao' }).events).toContainEqual({ type: 'refused', reason: 'NOT_FESTIVAL' });
  });
});

describe('豐穗祭：收成比賽', () => {
  /** 6 塊成熟的南瓜田在農場 (10..15, 12)，玩家站在每塊田的上方（11 列）向下面對它。 */
  function pumpkinFields(day: Calendar): GameState {
    const plots: PlotMap = {};
    for (let x = 10; x <= 15; x++) plots[plotKey(x, 12)] = plot('bell-pumpkin', 10);
    return game({ calendar: day, mapId: 'farm', plots, flags: {} });
  }

  function harvestAt(state: GameState, x: number): CommandOutcome {
    return run({ ...state, player: { x, y: 11, facing: 'down' } }, { type: 'interact' });
  }

  it('收成指定的作物累計到 6 個就完成，當天發一次獎勵；之後同一年不再發', () => {
    const start = pumpkinFields(at('autumn', 12, 720));
    // 每塊田收成 1 到 2 個，所以先放在 5 個，這一次收成一定會達到 6 個。
    const nearly = { ...start, festival: { ...start.festival, harvest: { year: 1, count: 5 } } };
    const done = harvestAt(nearly, 10);
    expect(done.state.festival.done['harvest-feast:contest']).toBe(1);
    expect(done.state.festival.harvest.count).toBeGreaterThanOrEqual(6);
    expect(done.messages).toContain('收成比賽完成！獎勵 400 金');
    expect(done.state.flags['attended:harvest-feast']).toBe(true);

    const later = harvestAt(done.state, 11);
    expect(later.messages).not.toContain('收成比賽完成！獎勵 400 金');
    expect(later.state.gold).toBeGreaterThanOrEqual(done.state.gold);
  });

  it('一次收成的數量會累計到比賽裡，還沒到目標時不發獎勵', () => {
    const out = harvestAt(pumpkinFields(at('autumn', 12, 720)), 10);
    expect(out.state.festival.harvest.count).toBeGreaterThanOrEqual(1);
    expect(out.state.festival.done['harvest-feast:contest']).toBeUndefined();
  });

  it('收成別的作物不計入比賽', () => {
    const plots: PlotMap = { [plotKey(10, 12)]: plot('dew-grass', 1) };
    const out = run(game({ calendar: at('autumn', 12, 720), mapId: 'farm', plots, player: { x: 10, y: 11, facing: 'down' } }), { type: 'interact' });
    expect(out.state.festival.harvest.count).toBe(0);
  });

  it('不在節慶當天收成，不計入比賽', () => {
    const state = pumpkinFields(at('autumn', 11, 720));
    expect(harvestAt(state, 10).state.festival.harvest.count).toBe(0);
  });
});

describe('暖燈節：點燈', () => {
  it('18:00 以前廣場的燈還沒開放', () => {
    const state = game({ calendar: at('winter', 20, 1000), mapId: 'plaza', player: { x: 2, y: 2, facing: 'up' } });
    expect(run(state, { type: 'interact' }).events).toContainEqual({ type: 'refused', reason: 'NOT_FESTIVAL' });
  });

  it('每盞燈每年點一次，點亮時發燈的獎勵，並算參加暖燈節', () => {
    const state = game({ ...WARM_NIGHT, player: { x: 2, y: 2, facing: 'up' } });
    const first = run(state, { type: 'interact' });
    expect(first.state.gold - state.gold).toBe(30);
    expect(first.state.festival.done['warm-lamp:lantern:2,1']).toBe(1);
    expect(first.state.flags['attended:warm-lamp']).toBe(true);

    const again = run(first.state, { type: 'interact' });
    expect(again.events).toContainEqual({ type: 'refused', reason: 'ALREADY_LIT' });
    expect(again.state.gold).toBe(first.state.gold);
  });

  it('點亮最後一盞時發全部點亮的獎勵，並設定旗標 lantern:all（只一次）', () => {
    const lit = ['2,1', '13,1', '4,4', '11,4', '2,8'];
    const done = Object.fromEntries(lit.map((k) => [`warm-lamp:lantern:${k}`, 1]));
    const state = game({ ...WARM_NIGHT, festival: { ...game({}).festival, done }, player: { x: 14, y: 10, facing: 'up' } });
    const out = run(state, { type: 'interact' });
    expect(out.state.gold - state.gold).toBe(30 + 200);
    expect(out.state.flags['lantern:all']).toBe(true);
    expect(out.messages.some((m) => m.includes('全部的燈'))).toBe(true);
  });
});

describe('暖燈節：交換禮物', () => {
  const beside = { ...WARM_NIGHT, player: { x: 9, y: 10, facing: 'up' as const } };

  it('送給指定的居民不受每日一次限制，收到一件回禮，每年有次數上限', () => {
    const start = withItems(game({ ...beside, friendship: { maomao: { points: 0, talkedDay: null, giftedDay: totalDay(at('winter', 20, 0), 20) } } }), { 'crop.moon-bean': 1 });
    const out = run(start, { type: 'giveGift', npcId: 'maomao', itemId: 'crop.moon-bean' });
    expect(countOf(out.state.inventory, 'crop.moon-bean')).toBe(0);
    expect(countOf(out.state.inventory, 'seed.ember-onion')).toBe(1);
    expect(out.state.festival.exchanged.counts['warm-gift']).toBe(1);
    expect(out.events).toContainEqual({ type: 'gifted', npcId: 'maomao', reaction: expect.any(String) });
  });

  it('同一天可以送兩次（都在暖燈節）', () => {
    const start = withItems(game({ ...beside }), { 'crop.moon-bean': 2 });
    const once = run(start, { type: 'giveGift', npcId: 'maomao', itemId: 'crop.moon-bean' });
    const twice = run(once.state, { type: 'giveGift', npcId: 'maomao', itemId: 'crop.moon-bean' });
    expect(countOf(twice.state.inventory, 'seed.ember-onion')).toBe(2);
    expect(twice.state.festival.exchanged.counts['warm-gift']).toBe(2);
  });

  it('每年的次數用完後，送禮回到每日一次的規則', () => {
    const used = { year: 1, counts: { 'warm-gift': 3 } };
    const state = withItems(game({ ...beside, festival: { ...game({}).festival, exchanged: used } }), { 'crop.moon-bean': 2 });
    const first = run(state, { type: 'giveGift', npcId: 'maomao', itemId: 'crop.moon-bean' });
    expect(first.events.some((e) => e.type === 'gifted')).toBe(true);
    expect(countOf(first.state.inventory, 'seed.ember-onion')).toBe(0);
    const second = run(first.state, { type: 'giveGift', npcId: 'maomao', itemId: 'crop.moon-bean' });
    expect(second.events).toContainEqual({ type: 'refused', reason: 'ALREADY_GIFTED' });
  });

  it('不在暖燈節的夜裡，送禮還是每天一次', () => {
    const state = withItems(game({ calendar: at('winter', 19, 1100), mapId: 'plaza', player: { x: 9, y: 10, facing: 'up' } }), { 'crop.moon-bean': 2 });
    const first = run(state, { type: 'giveGift', npcId: 'maomao', itemId: 'crop.moon-bean' });
    expect(first.events.some((e) => e.type === 'gifted')).toBe(true);
    const second = run(first.state, { type: 'giveGift', npcId: 'maomao', itemId: 'crop.moon-bean' });
    expect(second.events).toContainEqual({ type: 'refused', reason: 'ALREADY_GIFTED' });
  });
});

describe('溫室：改建、入口與冬季種植', () => {
  it('在雜貨店花 9000 金改建溫室，只能買一次，金幣不夠就不改建', () => {
    const counter = { calendar: at('spring', 5, 600), mapId: 'village', player: { x: 3, y: 5, facing: 'up' as const } };
    const rich = run(game({ ...counter, gold: 9000 }), { type: 'buy', shopId: 'general', itemId: 'building.greenhouse', count: 1 });
    expect(rich.state.flags.greenhouse).toBe(true);
    expect(rich.state.gold).toBe(0);
    expect(countOf(rich.state.inventory, 'building.greenhouse')).toBe(0);

    const again = run({ ...rich.state, gold: 9000 }, { type: 'buy', shopId: 'general', itemId: 'building.greenhouse', count: 1 });
    expect(again.events).toContainEqual({ type: 'refused', reason: 'ALREADY_OWNED' });

    const poor = run(game({ ...counter, gold: 8999 }), { type: 'buy', shopId: 'general', itemId: 'building.greenhouse', count: 1 });
    expect(poor.events).toContainEqual({ type: 'refused', reason: 'NO_GOLD' });
    expect(poor.state.flags.greenhouse).toBeUndefined();
  });

  it('溫室的門要有 greenhouse 旗標才開；進去後落在溫室裡面，走出去回到農場', () => {
    const outside = game({ calendar: at('winter', 5, 600), mapId: 'farm', player: { x: 30, y: 19, facing: 'down' } });
    const locked = run(outside, { type: 'move', direction: 'down' });
    expect(locked.state.mapId).toBe('farm');
    expect(locked.events).toContainEqual({ type: 'refused', reason: 'LOCKED_DOOR' });

    const opened = run({ ...outside, flags: { greenhouse: true } }, { type: 'move', direction: 'down' });
    expect(opened.state.mapId).toBe('farm');
    expect(opened.state.player).toMatchObject({ x: 30, y: 22 });

    const out = run({ ...opened.state, player: { x: 30, y: 22, facing: 'up' } }, { type: 'move', direction: 'up' });
    expect(out.state.player).toMatchObject({ x: 30, y: 19 });
  });

  it('冬季在溫室裡可以播秋季的作物，在溫室外的田不行', () => {
    const inside = game({
      calendar: at('winter', 5, 600),
      mapId: 'farm',
      flags: { greenhouse: true },
      player: { x: 30, y: 22, facing: 'right' },
      plots: { [plotKey(31, 22)]: plot(null) },
      inventory: createInventory(60),
      selectedSeed: 'bell-pumpkin',
      tool: 'seedbag',
    });
    const withSeed = addTo(inside, { 'seed.bell-pumpkin': 1 });
    const planted = run(withSeed, { type: 'interact' });
    expect(planted.state.plots[plotKey(31, 22)]?.crop).toEqual({ cropId: 'bell-pumpkin', growthDays: 0 });

    const outside = addTo(
      game({ calendar: at('winter', 5, 600), mapId: 'farm', plots: { [plotKey(10, 13)]: plot(null) }, player: { x: 10, y: 12, facing: 'down' }, tool: 'seedbag', selectedSeed: 'bell-pumpkin', inventory: createInventory(60) }),
      { 'seed.bell-pumpkin': 1 },
    );
    expect(run(outside, { type: 'interact' }).events).toContainEqual({ type: 'refused', reason: 'NOT_IN_SEASON' });
  });

  it('換季時，溫室裡的作物不枯死；溫室外不適合新季節的作物枯死', () => {
    const state = game({
      calendar: at('autumn', 20, 1300),
      mapId: 'house',
      flags: { greenhouse: true },
      player: { x: 4, y: 8, facing: 'up' },
      plots: {
        [plotKey(31, 22)]: plot('bell-pumpkin', 3, false),
        [plotKey(10, 13)]: plot('bell-pumpkin', 3, false),
      },
    });
    const slept = run(state, { type: 'interact' });
    expect(slept.state.calendar.season).toBe('winter');
    expect(slept.state.plots[plotKey(31, 22)]?.crop?.cropId).toBe('bell-pumpkin');
    expect(slept.state.plots[plotKey(10, 13)]?.crop).toBeNull();
    expect(slept.messages.some((m) => m.includes('枯死了'))).toBe(true);
  });
});

describe('雜貨店的季節進貨', () => {
  const counter = { mapId: 'village', player: { x: 3, y: 5, facing: 'up' as const } };

  it('秋季才買得到秋季的種子，冬季才買得到冬季的種子', () => {
    const autumn = run(game({ ...counter, calendar: at('autumn', 3, 600), gold: 500 }), { type: 'buy', shopId: 'general', itemId: 'seed.golden-rice', count: 1 });
    expect(countOf(autumn.state.inventory, 'seed.golden-rice')).toBe(1);

    const winterOnAutumn = run(game({ ...counter, calendar: at('winter', 3, 600), gold: 500 }), { type: 'buy', shopId: 'general', itemId: 'seed.golden-rice', count: 1 });
    expect(winterOnAutumn.events).toContainEqual({ type: 'refused', reason: 'NOT_IN_STOCK_SEASON' });

    const winter = run(game({ ...counter, calendar: at('winter', 3, 600), gold: 500 }), { type: 'buy', shopId: 'general', itemId: 'seed.ember-onion', count: 1 });
    expect(countOf(winter.state.inventory, 'seed.ember-onion')).toBe(1);
  });
});

describe('主線第 4、5 章', () => {
  it('第 4 章「秋收與溫室」：參加豐穗祭、溫室改建好，章節完成，發獎勵並推進到第 5 章', () => {
    const base = game({ calendar: at('autumn', 14, 600), story: { chapter: 4 }, flags: { 'attended:harvest-feast': true } });
    expect(run(base, { type: 'manualSave' }).state.story.chapter).toBe(4);

    const done = run({ ...base, flags: { ...base.flags, greenhouse: true } }, { type: 'manualSave' });
    expect(done.state.story.chapter).toBe(5);
    expect(done.state.flags['scene:greenhouse-open']).toBe(true);
    expect(countOf(done.state.inventory, 'seed.snow-radish')).toBe(2);
  });

  it('第 5 章「冬天的燈」：參加暖燈節、點亮所有的燈，章節完成，設定場景旗標', () => {
    const base = game({ calendar: at('winter', 20, 1200), story: { chapter: 5 }, flags: { 'attended:warm-lamp': true } });
    expect(run(base, { type: 'manualSave' }).state.story.chapter).toBe(5);

    const done = run({ ...base, flags: { ...base.flags, 'lantern:all': true } }, { type: 'manualSave' });
    expect(done.state.story.chapter).toBe(6);
    expect(done.state.flags['scene:lamplit-plaza']).toBe(true);
    expect(done.state.gold - base.gold).toBe(800);
  });
});
