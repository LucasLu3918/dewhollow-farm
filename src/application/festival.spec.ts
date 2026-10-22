import { describe, expect, it } from 'vitest';
import { createNewGame, type GameState } from '../domain/game-state';
import type { Calendar } from '../domain/calendar';
import { addItem, countOf, createInventory } from '../domain/inventory';
import { shippedIndex, shippedPack } from '../../tests/sim/shipped-content';
import { executeCommand, type Command, type CommandOutcome } from './game-commands';
import { storyObjective } from './story';

/**
 * M5c：萌芽祭（種子交換、花冠、釣魚比賽）、星河夜市（攤位、釣星星）、主線章節推進。
 * 使用真實內容（tests/sim/shipped-content.ts），所以內容改了這裡會一起檢查。
 */

function at(season: Calendar['season'], day: number, minuteOfDay: number, year = 1): Calendar {
  return { year, season, day, minuteOfDay };
}

function game(overrides: Partial<GameState>): GameState {
  return { ...createNewGame(shippedPack, 7), ...overrides };
}

function run(state: GameState, command: Command): CommandOutcome {
  return executeCommand(state, command, shippedIndex);
}

/** 把物品加進背包（保留原本的東西）。 */
function addTo(state: GameState, items: Record<string, number>): GameState {
  let inventory = state.inventory;
  for (const [itemId, count] of Object.entries(items)) {
    const stored = addItem(inventory, shippedIndex.item(itemId), count);
    if (!stored.ok) throw new Error(`背包放不下 ${itemId}`);
    inventory = stored.value;
  }
  return { ...state, inventory };
}

/** 一個只有指定物品的背包（測試的起點）。 */
function withItems(state: GameState, items: Record<string, number>): GameState {
  return addTo({ ...state, inventory: createInventory(60) }, items);
}

const SPROUT_NOON = { calendar: at('spring', 12, 720), mapId: 'plaza', weather: 'sunny' as const };

describe('萌芽祭：種子交換', () => {
  it('在節慶當天的鎮廣場、居民也在場，用給出的作物換到種子，每人每年一次', () => {
    const start = withItems(game({ ...SPROUT_NOON }), { 'crop.moon-bean': 2 });
    const first = run(start, { type: 'festivalSwap', npcId: 'maomao' });
    expect(countOf(first.state.inventory, 'crop.moon-bean')).toBe(0);
    expect(countOf(first.state.inventory, 'seed.star-pepper')).toBe(1);
    expect(first.state.festival.done['sprout:swap:maomao']).toBe(1);
    expect(first.state.flags['attended:sprout']).toBe(true);

    const again = run(addTo(first.state, { 'crop.moon-bean': 2 }), { type: 'festivalSwap', npcId: 'maomao' });
    expect(again.messages).toEqual(['今年已經做過這件事了']);
    expect(countOf(again.state.inventory, 'seed.star-pepper')).toBe(1);
  });

  it('下一年又可以換；材料不夠、不是節慶的日子、居民不在廣場都不會換', () => {
    const done = run(withItems(game({ ...SPROUT_NOON }), { 'crop.moon-bean': 2 }), { type: 'festivalSwap', npcId: 'maomao' }).state;
    const nextYear = run(addTo({ ...done, calendar: at('spring', 12, 720, 2) }, { 'crop.moon-bean': 2 }), { type: 'festivalSwap', npcId: 'maomao' });
    expect(countOf(nextYear.state.inventory, 'seed.star-pepper')).toBe(2);

    const short = run(withItems(game({ ...SPROUT_NOON }), { 'crop.moon-bean': 1 }), { type: 'festivalSwap', npcId: 'maomao' });
    expect(short.messages).toEqual(['材料不夠']);

    const otherDay = run(withItems(game({ ...SPROUT_NOON, calendar: at('spring', 13, 720) }), { 'crop.moon-bean': 2 }), { type: 'festivalSwap', npcId: 'maomao' });
    expect(otherDay.messages).toEqual(['現在沒有這個節慶活動（要在節慶當天的鎮廣場）']);

    const notPresent = run(withItems(game({ ...SPROUT_NOON, calendar: at('spring', 12, 360) }), { 'crop.moon-bean': 2 }), { type: 'festivalSwap', npcId: 'maomao' });
    expect(notPresent.messages).toEqual(['他現在不在廣場上']);
  });

  it('交換不花體力與時間', () => {
    const start = withItems(game({ ...SPROUT_NOON }), { 'crop.moon-bean': 2 });
    const after = run(start, { type: 'festivalSwap', npcId: 'maomao' }).state;
    expect(after.energy).toEqual(start.energy);
    expect(after.calendar).toEqual(start.calendar);
  });
});

describe('萌芽祭：花冠製作與獎勵', () => {
  it('在節慶當天的廣場用三朵春花做一個花冠，第一次有金幣獎勵，之後沒有', () => {
    const start = withItems(game({ ...SPROUT_NOON, gold: 0 }), { 'flower-spring': 6 });
    const first = run(start, { type: 'festivalCrown' });
    expect(countOf(first.state.inventory, 'flower-crown')).toBe(1);
    expect(countOf(first.state.inventory, 'flower-spring')).toBe(3);
    // 80 金是花冠的節慶獎勵；另外 150 金是第一次參加萌芽祭的成就（M5d）。
    expect(first.state.gold).toBe(80 + 150);

    const second = run(first.state, { type: 'festivalCrown' });
    expect(countOf(second.state.inventory, 'flower-crown')).toBe(2);
    expect(second.state.gold).toBe(80 + 150);
  });

  it('材料不夠時不做，也不給獎勵', () => {
    const start = withItems(game({ ...SPROUT_NOON, gold: 0 }), { 'flower-spring': 2 });
    const outcome = run(start, { type: 'festivalCrown' });
    expect(outcome.messages).toEqual(['材料不夠']);
    expect(outcome.state.gold).toBe(0);
  });
});

describe('萌芽祭：釣魚比賽', () => {
  it('節慶當天釣到三條魚就完成，獎勵只發一次', () => {
    let state = game({ ...SPROUT_NOON, mapId: 'lake', fishing: null, gold: 0 });
    const messages: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      state = { ...state, fishing: { fishId: 'carp' } };
      const outcome = run(state, { type: 'reel', hit: true });
      state = outcome.state;
      messages.push(...outcome.messages);
    }
    expect(state.festival.contest).toEqual({ year: 1, caught: 3 });
    // 200 金是比賽獎勵；另外是「第一條魚」（50）與「萌芽祭的參加者」（150）兩項成就（M5d）。
    expect(state.gold).toBe(200 + 50 + 150);
    expect(messages).toContain('釣魚比賽完成！獎勵 200 金');

    state = { ...state, fishing: { fishId: 'carp' } };
    expect(run(state, { type: 'reel', hit: true }).state.gold).toBe(200 + 50 + 150);
  });

  it('節慶之外釣到的魚不計入比賽', () => {
    const state = game({ calendar: at('spring', 11, 720), mapId: 'lake', fishing: { fishId: 'carp' } });
    const after = run(state, { type: 'reel', hit: true }).state;
    expect(after.festival.contest.caught).toBe(0);
  });
});

describe('星河夜市：攤位', () => {
  // 攤位在鎮廣場的右下角（13,10）。站在它的上方（13,9）面向下方。
  const STALL_FRONT = { ...SPROUT_NOON, calendar: at('summer', 14, 1200), player: { x: 13, y: 9, facing: 'down' as const } };

  it('只在節慶的夜晚開放；白天與其他日子買不到', () => {
    const day = run(game({ ...STALL_FRONT, calendar: at('summer', 14, 600), gold: 999 }), { type: 'buy', shopId: 'night-market', itemId: 'bait', count: 1 });
    expect(day.messages).toEqual(['這個攤位只在節慶的夜晚開放']);
    const night = run(game({ ...STALL_FRONT, gold: 999 }), { type: 'buy', shopId: 'night-market', itemId: 'bait', count: 1 });
    expect(night.messages[0]).toMatch(/買了 魚餌/);
  });

  it('有限量的物品今年賣完就不能再買，明年重算', () => {
    let state = game({ ...STALL_FRONT, gold: 9999 });
    for (let i = 0; i < 6; i += 1) state = run(state, { type: 'buy', shopId: 'night-market', itemId: 'bait', count: 1 }).state;
    expect(countOf(state.inventory, 'bait')).toBe(6);
    const soldOut = run(state, { type: 'buy', shopId: 'night-market', itemId: 'bait', count: 1 });
    expect(soldOut.messages).toEqual(['這項今年已經賣完了']);
    const nextYear = run({ ...state, calendar: at('summer', 14, 1200, 2) }, { type: 'buy', shopId: 'night-market', itemId: 'bait', count: 1 });
    expect(nextYear.messages[0]).toMatch(/買了 魚餌/);
  });
});

describe('星河夜市：釣星星', () => {
  // 池子在鎮廣場左上（8–9, 2–3）。站在 (9,4) 面向上方 (9,3)。
  const POOL_FRONT = { mapId: 'plaza', calendar: at('summer', 14, 1200), player: { x: 9, y: 4, facing: 'up' as const }, weather: 'sunny' as const };

  it('在夜市的池子前甩竿，按 X 的時機對了就接到星河碎片', () => {
    const cast = run(game({ ...POOL_FRONT }), { type: 'castStar' });
    expect(cast.state.starLine).toBe(true);
    expect(cast.events).toContainEqual({ type: 'starLine' });
    expect(cast.state.energy.current).toBe(98);
    const caught = run(cast.state, { type: 'catchStar', elapsedMs: 1040 });
    expect(countOf(caught.state.inventory, 'star-shard')).toBe(1);
    expect(caught.state.starLine).toBe(false);
  });

  it('時機不對、沒有按、或沒甩竿都接不到，而且不會重複收網', () => {
    const cast = run(game({ ...POOL_FRONT }), { type: 'castStar' }).state;
    const missed = run(cast, { type: 'catchStar', elapsedMs: 300 });
    expect(countOf(missed.state.inventory, 'star-shard')).toBe(0);
    expect(missed.messages).toEqual(['星星溜走了']);

    const timedOut = run(cast, { type: 'catchStar', elapsedMs: null });
    expect(countOf(timedOut.state.inventory, 'star-shard')).toBe(0);

    const again = run(timedOut.state, { type: 'catchStar', elapsedMs: 1040 });
    expect(again.messages).toEqual(['還沒有甩竿，不能收網']);
  });

  it('甩竿後做別的動作，星星的線就放掉了', () => {
    const cast = run(game({ ...POOL_FRONT }), { type: 'castStar' }).state;
    const moved = run(cast, { type: 'move', direction: 'left' }).state;
    expect(moved.starLine).toBe(false);
  });

  it('不在池子前、或不是夜市的時間，甩不了竿', () => {
    expect(run(game({ ...POOL_FRONT, player: { x: 9, y: 5, facing: 'up' } }), { type: 'castStar' }).messages).toEqual(['要站在星星水池前面才能釣星星']);
    expect(run(game({ ...POOL_FRONT, calendar: at('summer', 14, 600) }), { type: 'castStar' }).messages).toEqual(['星星要等夜市開始、晚上才會出現在水池裡']);
  });

  it('從鎮廣場的告示前按 X 會打開節慶面板', () => {
    const board = run(game({ mapId: 'plaza', calendar: at('spring', 1, 600), player: { x: 1, y: 9, facing: 'up' } }), { type: 'interact' });
    expect(board.events).toContainEqual({ type: 'festivalOpened' });
  });
});

describe('主線：章節推進', () => {
  it('第 1 章的三個步驟都達成時，發獎勵並推進到第 2 章', () => {
    const state = game({
      flags: { 'talked:maomao': true, 'done:till': true },
      mapId: 'plaza',
      calendar: at('spring', 2, 600),
    });
    const shipped = run({ ...state, flags: { ...state.flags, 'done:ship': true } }, { type: 'manualSave' });
    expect(shipped.state.story.chapter).toBe(2);
    expect(shipped.state.flags['main:1']).toBe(true);
    expect(shipped.state.gold).toBe(state.gold + 200);
    expect(countOf(shipped.state.inventory, 'seed.moon-bean')).toBeGreaterThanOrEqual(2);
    expect(shipped.messages.join('\n')).toContain('主線第 1 章完成');
  });

  it('步驟還沒達成時章節不動；睡醒的提示會說還要做什麼', () => {
    const state = game({ flags: { 'talked:maomao': true }, calendar: at('spring', 2, 600) });
    const outcome = run(state, { type: 'manualSave' });
    expect(outcome.state.story.chapter).toBe(1);
    expect(storyObjective(outcome.state, shippedIndex)).toContain('開墾一塊田');
  });

  it('委託步驟要完成（不是只接下）才算', () => {
    const state = game({
      story: { chapter: 2 },
      flags: { 'talked:rong-bo': true, 'talked:a-gan': true, 'talked:shi-shifu': true, 'talked:zhi-lan': true, 'talked:xiao-sui': true },
      quests: { 'maomao-walk': { status: 'active', progress: 0, seen: [] } },
    });
    expect(run(state, { type: 'manualSave' }).state.story.chapter).toBe(2);
    const done = { ...state, quests: { 'maomao-walk': { status: 'done' as const, progress: 0, seen: [] } } };
    expect(run(done, { type: 'manualSave' }).state.story.chapter).toBe(3);
  });
});

describe('星河兌換：夜市用星河碎片換物品', () => {
  // 夏 14 夜裡的鎮廣場：夜市開著，兌換攤位在節慶面板上（不必站在哪裡）。
  const MARKET = { mapId: 'plaza', calendar: at('summer', 14, 1200), weather: 'sunny' as const };
  // 小屋的工作台 (4,1)，站在 (4,2) 面向上方。
  const BENCH = { mapId: 'house', player: { x: 4, y: 2, facing: 'up' as const } };

  it('用碎片換裝飾：碎片扣掉、物品進背包，今年的次數記下來', () => {
    const start = withItems(game({ ...MARKET }), { 'star-shard': 5 });
    const out = run(start, { type: 'starExchange', lineId: 'star-string' });
    expect(countOf(out.state.inventory, 'star-shard')).toBe(2);
    expect(countOf(out.state.inventory, 'star-string')).toBe(1);
    expect(out.state.festival.exchanged).toEqual({ year: 1, counts: { 'star-string': 1 } });
    expect(out.messages.join('\n')).toContain('星空燈串');
  });

  it('碎片不夠時不兌換，碎片與物品都不變，並說明原因', () => {
    const start = withItems(game({ ...MARKET }), { 'star-shard': 2 });
    const out = run(start, { type: 'starExchange', lineId: 'star-string' });
    expect(out.messages).toEqual(['星河碎片不夠']);
    expect(countOf(out.state.inventory, 'star-shard')).toBe(2);
    expect(countOf(out.state.inventory, 'star-string')).toBe(0);
    expect(out.events).toContainEqual({ type: 'refused', reason: 'NOT_ENOUGH_SHARDS' });
  });

  it('同一項今年只能換一次：達上限時說明且不扣碎片；明年又能換', () => {
    const once = run(withItems(game({ ...MARKET }), { 'star-shard': 9 }), { type: 'starExchange', lineId: 'star-string' }).state;
    const again = run(once, { type: 'starExchange', lineId: 'star-string' });
    expect(again.messages).toEqual(['這項今年已經換過了']);
    expect(countOf(again.state.inventory, 'star-shard')).toBe(6);
    const nextYear = run({ ...again.state, calendar: at('summer', 14, 1200, 2) }, { type: 'starExchange', lineId: 'star-string' });
    expect(countOf(nextYear.state.inventory, 'star-string')).toBe(2);
    expect(countOf(nextYear.state.inventory, 'star-shard')).toBe(3);
  });

  it('碎片跨年保留：換年後碎片還在，之後可以拿去換別的', () => {
    const once = run(withItems(game({ ...MARKET }), { 'star-shard': 9 }), { type: 'starExchange', lineId: 'star-string' }).state;
    const nextYear = { ...once, calendar: at('spring', 1, 600, 2) };
    expect(countOf(nextYear.inventory, 'star-shard')).toBe(6);
    const later = run({ ...nextYear, calendar: at('summer', 14, 1200, 2) }, { type: 'starExchange', lineId: 'night-canvas' });
    expect(countOf(later.state.inventory, 'night-canvas')).toBe(1);
    expect(countOf(later.state.inventory, 'star-shard')).toBe(1);
  });

  it('兌換不花體力與時間', () => {
    const start = withItems(game({ ...MARKET }), { 'star-shard': 5 });
    const after = run(start, { type: 'starExchange', lineId: 'star-string' }).state;
    expect(after.energy).toEqual(start.energy);
    expect(after.calendar).toEqual(start.calendar);
  });

  it('不是夜市的時間（白天）或不在鎮廣場，兌換不了', () => {
    const day = run(withItems(game({ ...MARKET, calendar: at('summer', 14, 600) }), { 'star-shard': 9 }), { type: 'starExchange', lineId: 'star-string' });
    expect(day.messages).toEqual(['現在沒有這個節慶活動（要在節慶當天的鎮廣場）']);
    const elsewhere = run(withItems(game({ ...MARKET, mapId: 'farm' }), { 'star-shard': 9 }), { type: 'starExchange', lineId: 'star-string' });
    expect(elsewhere.messages).toEqual(['現在沒有這個節慶活動（要在節慶當天的鎮廣場）']);
  });

  it('沒有這一項兌換的話，回報找不到', () => {
    const out = run(withItems(game({ ...MARKET }), { 'star-shard': 9 }), { type: 'starExchange', lineId: 'nothing' });
    expect(out.messages).toEqual(['沒有這項兌換']);
  });

  it('兌換配方的旗標：換到之前工作台做不了星河糖，換到之後就做得出來', () => {
    const before = run(withItems(game({ ...BENCH }), { mint: 2, hay: 1 }), { type: 'craft', recipeId: 'star-sugar' });
    expect(before.messages).toEqual(['還沒有這個配方，要先在夜市的星河兌換換到']);
    expect(countOf(before.state.inventory, 'star-sugar')).toBe(0);

    const exchanged = run(withItems(game({ ...MARKET }), { 'star-shard': 4 }), { type: 'starExchange', lineId: 'star-sugar-recipe' });
    expect(exchanged.state.flags['recipe:star-sugar']).toBe(true);
    expect(countOf(exchanged.state.inventory, 'star-shard')).toBe(0);

    const again = run(withItems({ ...exchanged.state, ...MARKET, calendar: at('summer', 14, 1200, 2) }, { 'star-shard': 4 }), {
      type: 'starExchange',
      lineId: 'star-sugar-recipe',
    });
    expect(again.messages).toEqual(['這份配方已經解鎖過了']);
    expect(countOf(again.state.inventory, 'star-shard')).toBe(4);

    const made = run(addTo({ ...exchanged.state, ...BENCH, calendar: at('spring', 2, 600) }, { mint: 2, hay: 1 }), { type: 'craft', recipeId: 'star-sugar' });
    expect(countOf(made.state.inventory, 'star-sugar')).toBe(2);
  });
});
