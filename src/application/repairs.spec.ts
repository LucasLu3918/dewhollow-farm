import { describe, expect, it } from 'vitest';
import { createNewGame, type GameState } from '../domain/game-state';
import type { Calendar } from '../domain/calendar';
import { addItem, countOf, createInventory } from '../domain/inventory';
import { shippedIndex, shippedPack } from '../../tests/sim/shipped-content';
import { executeCommand, type Command, type CommandOutcome } from './game-commands';

/**
 * M5d：社區修復（捐獻、完成、獎勵旗標）。使用真實內容（tests/sim/shipped-content.ts）。
 */

const GARDEN_FLOWERS = ['mushroom', 'berry', 'flower-spring', 'flower-summer', 'herb', 'fern-shoot', 'flower-bell', 'creek-celery', 'flower-night', 'pine-nut'];

function at(season: Calendar['season'], day: number, minuteOfDay: number, year = 1): Calendar {
  return { year, season, day, minuteOfDay };
}

function game(overrides: Partial<GameState>): GameState {
  return { ...createNewGame(shippedPack, 7), ...overrides };
}

function run(state: GameState, command: Command): CommandOutcome {
  return executeCommand(state, command, shippedIndex);
}

/** 只有指定物品的背包（測試的起點）。 */
function withItems(state: GameState, items: Record<string, number>): GameState {
  let inventory = createInventory(60);
  for (const [itemId, count] of Object.entries(items)) {
    const stored = addItem(inventory, shippedIndex.item(itemId), count);
    if (!stored.ok) throw new Error(`背包放不下 ${itemId}`);
    inventory = stored.value;
  }
  return { ...state, inventory };
}

const SPRING_PLAZA = { calendar: at('spring', 4, 600), mapId: 'plaza', weather: 'sunny' as const };
const SUMMER_PLAZA = { calendar: at('summer', 4, 600), mapId: 'plaza', weather: 'sunny' as const };

describe('捐獻（donate）', () => {
  it('捐一件花：扣掉背包的東西、記下進度，不花體力也不花時間', () => {
    const start = withItems(game({ ...SPRING_PLAZA }), { mushroom: 2 });
    const out = run(start, { type: 'donate', repairId: 'garden', itemId: 'mushroom', count: 1 });
    expect(countOf(out.state.inventory, 'mushroom')).toBe(1);
    expect(out.state.repairs.garden?.donated).toEqual({ mushroom: 1 });
    expect(out.state.energy).toEqual(start.energy);
    expect(out.state.calendar).toEqual(start.calendar);
  });

  it('物品不夠時拒絕，背包與進度都不變', () => {
    const start = withItems(game({ ...SPRING_PLAZA }), { mushroom: 1 });
    const out = run(start, { type: 'donate', repairId: 'garden', itemId: 'mushroom', count: 2 });
    expect(out.events).toContainEqual({ type: 'refused', reason: 'REPAIR_ENOUGH' });
    expect(countOf(out.state.inventory, 'mushroom')).toBe(1);
    expect(out.state.repairs.garden).toBeUndefined();
  });

  it('不是修復季節時拒絕（夏天不能捐花園修復）', () => {
    const start = withItems(game({ ...SUMMER_PLAZA }), { mushroom: 1 });
    const out = run(start, { type: 'donate', repairId: 'garden', itemId: 'mushroom', count: 1 });
    expect(out.events).toContainEqual({ type: 'refused', reason: 'REPAIR_CLOSED' });
    expect(countOf(out.state.inventory, 'mushroom')).toBe(1);
  });

  it('不在候選清單裡的東西拒絕', () => {
    const start = withItems(game({ ...SPRING_PLAZA }), { 'fish.carp': 1 });
    const out = run(start, { type: 'donate', repairId: 'garden', itemId: 'fish.carp', count: 1 });
    expect(out.events).toContainEqual({ type: 'refused', reason: 'NOT_REPAIR_ITEM' });
  });

  it('沒有這個修復目標時拒絕', () => {
    const out = run(withItems(game({ ...SPRING_PLAZA }), { mushroom: 1 }), { type: 'donate', repairId: 'nowhere', itemId: 'mushroom', count: 1 });
    expect(out.events).toContainEqual({ type: 'refused', reason: 'NO_REPAIR' });
  });
});

describe('花園修復（春）完成', () => {
  it('十種花與野菜各捐一件就完成：設定噴泉圖紙與修復旗標，並給金幣', () => {
    let state = withItems(game({ ...SPRING_PLAZA }), Object.fromEntries(GARDEN_FLOWERS.map((id) => [id, 1])));
    const gold = state.gold;
    let last: CommandOutcome | null = null;
    for (const itemId of GARDEN_FLOWERS) {
      last = run(state, { type: 'donate', repairId: 'garden', itemId, count: 1 });
      state = last.state;
    }
    expect(state.flags['repair:garden']).toBe(true);
    expect(state.flags['blueprint:fountain']).toBe(true);
    expect(state.gold).toBe(gold + 300);
    expect(state.repairs.garden?.done).toBe(true);
    expect(last?.messages.join('\n')).toContain('修復完成');
  });

  it('完成之後再捐就拒絕，不再給獎勵', () => {
    let state = withItems(game({ ...SPRING_PLAZA }), Object.fromEntries(GARDEN_FLOWERS.map((id) => [id, 1])));
    for (const itemId of GARDEN_FLOWERS) state = run(state, { type: 'donate', repairId: 'garden', itemId, count: 1 }).state;
    const gold = state.gold;
    const again = run(withItems(state, { mushroom: 1 }), { type: 'donate', repairId: 'garden', itemId: 'mushroom', count: 1 });
    expect(again.events).toContainEqual({ type: 'refused', reason: 'REPAIR_DONE' });
    expect(again.state.gold).toBe(gold);
  });

  it('噴泉的合成配方要等圖紙旗標（blueprint:fountain）才能做', () => {
    const recipe = shippedIndex.craftingRecipe('fountain');
    expect(recipe.unlock).toEqual({ flag: 'blueprint:fountain' });
  });
});

describe('湖畔修復（夏）完成與主線第 3 章', () => {
  it('捐滿 8 條魚就完成：設定湖畔橋與湖畔小屋的旗標', () => {
    let state = withItems(game({ ...SUMMER_PLAZA }), { 'fish.carp': 5, 'fish.bass': 3 });
    state = run(state, { type: 'donate', repairId: 'lake', itemId: 'fish.carp', count: 5 }).state;
    expect(state.flags['repair:lake-bridge']).toBeUndefined();
    state = run(state, { type: 'donate', repairId: 'lake', itemId: 'fish.bass', count: 3 }).state;
    expect(state.flags['repair:lake-bridge']).toBe(true);
    expect(state.flags['repair:lake-house']).toBe(true);
  });

  it('修好湖畔橋後，主線第 3 章（已參加萌芽祭）自動完成，進到第 4 章之前的章節', () => {
    const start = withItems(
      game({ ...SUMMER_PLAZA, story: { chapter: 3 }, flags: { 'attended:sprout': true }, gold: 0 }),
      { 'fish.carp': 8 },
    );
    const out = run(start, { type: 'donate', repairId: 'lake', itemId: 'fish.carp', count: 8 });
    expect(out.state.story.chapter).toBe(4);
    expect(out.state.flags['main:3']).toBe(true);
    expect(out.messages.join('\n')).toContain('主線第 3 章完成');
  });

  it('春天不能捐湖畔修復', () => {
    const out = run(withItems(game({ ...SPRING_PLAZA }), { 'fish.carp': 1 }), { type: 'donate', repairId: 'lake', itemId: 'fish.carp', count: 1 });
    expect(out.events).toContainEqual({ type: 'refused', reason: 'REPAIR_CLOSED' });
  });
});

describe('修復告示（廣場的 repair 告示）', () => {
  it('站在告示前按互動，打開修復面板（不花體力與時間）', () => {
    const plaza = shippedIndex.map('plaza');
    const notice = Object.entries(plaza.legend).find(([, tile]) => tile.notice === 'repair');
    expect(notice).toBeDefined();
    const symbol = notice?.[0];
    const row = plaza.rows.findIndex((r) => symbol !== undefined && r.includes(symbol));
    const x = plaza.rows[row]?.indexOf(symbol ?? '') ?? -1;
    // 站在告示的正上方（往下面向它）。
    const state = game({ ...SPRING_PLAZA, player: { x, y: row - 1, facing: 'down' } });
    const out = run(state, { type: 'interact' });
    expect(out.events).toContainEqual({ type: 'repairOpened' });
    expect(out.state.energy).toEqual(state.energy);
  });
});
