import { describe, expect, it } from 'vitest';
import { createNewGame, type GameState } from '../domain/game-state';
import type { Calendar } from '../domain/calendar';
import { totalDay } from '../domain/calendar';
import { rollDailyEvent } from '../domain/random-events';
import { addItem, countOf, createInventory } from '../domain/inventory';
import { shippedIndex, shippedPack } from '../../tests/sim/shipped-content';
import { executeCommand, type Command, type CommandOutcome } from './game-commands';
import { eventBitePoints, eventYieldChance, todayEvent } from './random-events';
import { currentPeriod, residentsOn } from './residents';

/**
 * M5d：隨機事件的套用。事件由日期種子決定（見 domain/random-events.ts）；這裡測的是套用到狀態上的效果。
 */

const DAYS = shippedPack.tuning.time.daysPerSeason;

function at(season: Calendar['season'], day: number, minuteOfDay: number, year = 1): Calendar {
  return { year, season, day, minuteOfDay };
}

function game(overrides: Partial<GameState>): GameState {
  return { ...createNewGame(shippedPack, 7), ...overrides };
}

function run(state: GameState, command: Command): CommandOutcome {
  return executeCommand(state, command, shippedIndex);
}

/** 今天是指定事件的一天（狀態裡記下今天的事件）。 */
function withEvent(state: GameState, id: string | null): GameState {
  return { ...state, dailyEvent: { day: totalDay(state.calendar, DAYS), id } };
}

/** 在屋裡的床前按互動睡覺，回傳睡醒後的狀態。 */
function sleepOf(state: GameState): GameState {
  const house = shippedIndex.map('house');
  const bedSymbol = Object.entries(house.legend).find(([, tile]) => tile.kind === 'bed')?.[0];
  let bed: { x: number; y: number } | null = null;
  house.rows.forEach((row, y) => {
    const x = bedSymbol === undefined ? -1 : row.indexOf(bedSymbol);
    if (x >= 0 && bed === null) bed = { x, y };
  });
  if (bed === null) throw new Error('house 沒有床');
  const { x, y } = bed as { x: number; y: number };
  const placed = { ...state, mapId: 'house', player: { x, y: y + 1, facing: 'up' as const } };
  return run(placed, { type: 'interact' }).state;
}

describe('睡醒：今天的事件寫進狀態，且與日期種子的結果一致', () => {
  it('睡醒後 dailyEvent 是新的一天的抽取結果（天氣用新的一天的天氣）', () => {
    const start = game({ calendar: at('spring', 4, 1300), weather: 'sunny', forecast: 'rain', inventory: createInventory(60) });
    const slept = sleepOf(start);
    const expected = rollDailyEvent(shippedIndex.randomEvents, slept.calendar, slept.weather, DAYS);
    expect(slept.weather).toBe('rain');
    expect(slept.dailyEvent).toEqual({ day: totalDay(slept.calendar, DAYS), id: expected?.id ?? null });
  });
});

describe('白天事件的效果：採集加成、釣魚上鉤加成', () => {
  it('野花盛開：採集的額外產出機率加成，只在當天有效', () => {
    const today = withEvent(game({ calendar: at('spring', 4, 600) }), 'wildflowers');
    expect(eventYieldChance(today, shippedIndex, 'forage')).toBeGreaterThan(0);
    expect(eventYieldChance(today, shippedIndex, 'chop')).toBe(0);
    expect(eventYieldChance({ ...today, calendar: at('spring', 5, 600) }, shippedIndex, 'forage')).toBe(0);
  });

  it('湖面起霧：上鉤機率加成（百分點），沒有事件時是 0', () => {
    const today = withEvent(game({ calendar: at('summer', 4, 600) }), 'lake-fog');
    expect(eventBitePoints(today, shippedIndex)).toBeGreaterThan(0);
    expect(eventBitePoints(withEvent(today, null), shippedIndex)).toBe(0);
  });

  it('沒有事件或日期不符的日子，todayEvent 是 null', () => {
    const state = game({ calendar: at('spring', 4, 600) });
    expect(todayEvent(withEvent(state, null), shippedIndex)).toBeNull();
    expect(todayEvent({ ...withEvent(state, 'lake-fog'), calendar: at('spring', 9, 600) }, shippedIndex)).toBeNull();
  });
});

describe('物品型事件：夜間的事件在睡前入袋；背包放不下就不入袋', () => {
  it('夜空流星：睡覺時得到星河碎片（夜間事件）', () => {
    const start = withEvent(
      game({ calendar: at('summer', 4, 1260), weather: 'sunny', forecast: 'sunny', inventory: createInventory(60) }),
      'meteor',
    );
    const slept = sleepOf(start);
    expect(countOf(slept.inventory, 'star-shard')).toBe(countOf(start.inventory, 'star-shard') + 1);
  });

  it('背包放不下時睡覺照常完成，物品不入袋', () => {
    const full = addItem(createInventory(1), shippedIndex.item('hay'), 1);
    if (!full.ok) throw new Error('setup');
    const start = withEvent(game({ calendar: at('summer', 4, 1260), weather: 'sunny', forecast: 'sunny', inventory: full.value }), 'meteor');
    const slept = sleepOf(start);
    expect(slept.calendar.day).toBe(5);
    expect(countOf(slept.inventory, 'star-shard')).toBe(0);
  });
});

describe('廣場音樂會：居民的行程改變', () => {
  it('音樂會的傍晚，居民在廣場的音樂會位置出現（不論平常在哪裡）', () => {
    const state = withEvent(game({ calendar: at('spring', 4, 1200), mapId: 'plaza', weather: 'sunny' }), 'plaza-concert');
    expect(currentPeriod(state, shippedIndex)).toBe('evening');
    const placed = residentsOn(state, shippedIndex);
    const concert = shippedIndex.randomEvents.events.find((e) => e.id === 'plaza-concert');
    if (concert?.effect.type !== 'concert') throw new Error('concert effect missing');
    for (const spot of concert.effect.spots) {
      expect(placed).toContainEqual({ npcId: spot.npcId, x: spot.x, y: spot.y });
    }
  });

  it('同一天沒有音樂會時，傍晚的居民不會站在音樂會的位置上', () => {
    const state = withEvent(game({ calendar: at('spring', 4, 1200), mapId: 'plaza', weather: 'sunny' }), null);
    const concert = shippedIndex.randomEvents.events.find((e) => e.id === 'plaza-concert');
    if (concert?.effect.type !== 'concert') throw new Error('concert effect missing');
    const placed = residentsOn(state, shippedIndex);
    for (const spot of concert.effect.spots) {
      expect(placed.some((r) => r.npcId === spot.npcId && r.x === spot.x && r.y === spot.y)).toBe(false);
    }
  });
});
