import { describe, expect, it } from 'vitest';
import { createNewGame, type GameState } from '../domain/game-state';
import { plotKey } from '../domain/farm';
import { applySellBonus } from '../domain/talents';
import { priceWithQuality } from '../domain/pricing';
import { executeCommand } from './game-commands';
import { settleStory } from './story';
import { shippedIndex, shippedPack } from '../../tests/sim/shipped-content';

/**
 * M6：農場評級的收入、豐收重置與傳承（使用真實內容，見 tests/sim/shipped-content.ts）。
 * 公告在小屋（house）的 (1,2)，床的正下方（notice: legacy）；站在它右邊的 (2,2) 面向左。
 * 公告不放在床的右邊 (3,1)，那一格是既有的路線，會擋住收成與出貨的端到端測試。
 */

const NOTICE_SIDE = { x: 2, y: 2, facing: 'left' as const };
const BED_SIDE = { x: 2, y: 1, facing: 'left' as const };
const YEAR_TWO_MORNING = { year: 2, season: 'spring' as const, day: 1, minuteOfDay: 360 };
const CROP = 'crop.sweet-radish';

/** 第 2 年春季第 1 天，站在公告前面的一般狀態。 */
function base(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createNewGame(shippedPack, 42),
    mapId: 'house',
    player: NOTICE_SIDE,
    calendar: YEAR_TWO_MORNING,
    ...overrides,
  };
}

/** 一個能讓睡覺時出貨的狀態：出貨箱裡有一顆甜蘿蔔，站在床邊。 */
function sleeper(overrides: Partial<GameState> = {}): GameState {
  return base({
    player: BED_SIDE,
    shipBox: { entries: [{ itemId: CROP, quality: 'normal', count: 1 }] },
    ...overrides,
  });
}

describe('豐收重置：時機、確認與清空', () => {
  it('站在床邊的公告前面按互動，打開面板（不花時間、不改變狀態）', () => {
    const state = base();
    const out = executeCommand(state, { type: 'interact' }, shippedIndex);
    expect(out.events).toContainEqual({ type: 'legacyOpened' });
    expect(out.state.calendar).toEqual(state.calendar);
    expect(out.state.energy).toEqual(state.energy);
  });

  it('不是站在公告前面，豐收重置被拒絕（NOT_AT_NOTICE），狀態不變', () => {
    const away = base({ player: { x: 3, y: 3, facing: 'up' } });
    const out = executeCommand(away, { type: 'harvestReset', confirmed: true }, shippedIndex);
    expect(out.events).toContainEqual({ type: 'refused', reason: 'NOT_AT_NOTICE' });
    expect(out.state).toEqual(away);
  });

  it('第 1 年不能豐收重置（RESET_CLOSED），狀態不變', () => {
    const state = base({ calendar: { ...YEAR_TWO_MORNING, year: 1 } });
    const out = executeCommand(state, { type: 'harvestReset', confirmed: true }, shippedIndex);
    expect(out.events).toContainEqual({ type: 'refused', reason: 'RESET_CLOSED' });
    expect(out.state).toEqual(state);
  });

  it('沒有確認（confirmed 為 false）：什麼都不改變，回報需要再按一次', () => {
    const state = base({ gold: 5000, resetBonus: 0 });
    const out = executeCommand(state, { type: 'harvestReset', confirmed: false }, shippedIndex);
    expect(out.events).toContainEqual({ type: 'refused', reason: 'NOT_CONFIRMED' });
    expect(out.state).toEqual(state);
    expect(out.messages.join('')).toContain('再按一次');
  });

  it('確認後清空當年的金幣、田地、物品與出貨箱、建築改建與動物；保留圖鑑、成就、好感與技能', () => {
    const state = base({
      gold: 5000,
      flags: { 'house-wing': true, greenhouse: true, cowbarn: true, sprinkler: true, 'main:1': true, 'talked:maomao': true },
      plots: { [plotKey(4, 4)]: { watered: true, crop: { cropId: 'sweet-radish', growthDays: 2 }, dryDays: 0 } },
      shipBox: { entries: [{ itemId: CROP, quality: 'normal', count: 2 }] },
      animals: [{ kind: 'chicken', fed: true, petted: false, milked: false, mood: 3 }],
      collection: { found: ['fish.carp'], claimed: ['fish:25'] },
      achievements: { unlocked: ['sprout-festival', 'first-catch'], counters: {}, titles: ['修復委員'] },
      friendship: { maomao: { points: 40, talkedDay: null, giftedDay: null } },
      skills: { ...base().skills, farming: 30 },
      dexFragments: 2,
    });
    const out = executeCommand(state, { type: 'harvestReset', confirmed: true }, shippedIndex);

    expect(out.events).not.toContainEqual(expect.objectContaining({ type: 'refused' }));
    expect(out.state.gold).toBe(shippedPack.start.gold);
    expect(out.state.plots).toEqual({});
    expect(out.state.shipBox.entries).toEqual([]);
    expect(out.state.animals).toEqual([]);
    expect(out.state.cows).toEqual([]);
    expect(out.state.sheep).toEqual([]);
    expect(out.state.decor).toEqual({});
    expect(out.state.wearing).toEqual({});
    expect(out.state.flags['house-wing']).toBeUndefined();
    expect(out.state.flags.greenhouse).toBeUndefined();
    expect(out.state.flags.cowbarn).toBeUndefined();
    expect(out.state.flags.sprinkler).toBeUndefined();
    expect(out.state.flags['main:1']).toBe(true);
    expect(out.state.flags['talked:maomao']).toBe(true);
    expect(out.state.mapId).toBe(shippedPack.start.mapId);
    expect(out.state.friendship).toEqual(state.friendship);
    expect(out.state.skills).toEqual(state.skills);
    expect(out.state.collection.found).toContain('fish.carp');
    expect(out.state.collection.claimed).toEqual(['fish:25']);
    expect(out.state.achievements.unlocked).toContain('sprout-festival');
    expect(out.state.achievements.titles).toEqual(['修復委員']);
    expect(out.state.dexFragments).toBe(2);
    expect(out.state.resetBonus).toBe(1);
  });

  it('次數已經滿 3 次，不能再做（RESET_LIMIT）', () => {
    const state = base({ resetBonus: 3, gold: 5000 });
    const out = executeCommand(state, { type: 'harvestReset', confirmed: true }, shippedIndex);
    expect(out.events).toContainEqual({ type: 'refused', reason: 'RESET_LIMIT' });
    expect(out.state).toEqual(state);
  });
});

describe('豐收重置的作物售價加成（每次 +5%，最多 3 次）', () => {
  it('作物的售價隨豐收重置次數增加', () => {
    const price = shippedIndex.item(CROP).sellPrice ?? 0;
    const soldFor = (resetBonus: number) => {
      const state = sleeper({ resetBonus });
      return executeCommand(state, { type: 'interact' }, shippedIndex).state.gold - state.gold;
    };
    expect(soldFor(0)).toBe(priceWithQuality(price, 'normal'));
    expect(soldFor(2)).toBe(applySellBonus(priceWithQuality(price, 'normal'), 10));
  });
});

describe('傳承：主線第 5 章之後，二次確認，其餘全部重新開始', () => {
  const finished = (overrides: Partial<GameState> = {}) =>
    base({
      story: { chapter: 6 },
      gold: 9999,
      resetBonus: 2,
      yearlyIncome: 800,
      previousYearIncome: 300,
      generation: 1,
      playerName: '小涵',
      friendship: { maomao: { points: 40, talkedDay: null, giftedDay: null } },
      collection: { found: ['fish.carp'], claimed: ['fish:25'] },
      achievements: { unlocked: ['sprout-festival', 'first-catch'], counters: {}, titles: ['修復委員'] },
      calendar: { year: 3, season: 'autumn', day: 5, minuteOfDay: 360 },
      ...overrides,
    });

  it('主線第 5 章還沒完成，傳承被拒絕（LEGACY_LOCKED），狀態不變', () => {
    const state = finished({ story: { chapter: 5 } });
    const out = executeCommand(state, { type: 'legacy', name: '小禾', confirmed: true }, shippedIndex);
    expect(out.events).toContainEqual({ type: 'refused', reason: 'LEGACY_LOCKED' });
    expect(out.state).toEqual(state);
  });

  it('名字不合法（空白）被拒絕（BAD_NAME），狀態不變', () => {
    const state = finished();
    const out = executeCommand(state, { type: 'legacy', name: '   ', confirmed: true }, shippedIndex);
    expect(out.events).toContainEqual({ type: 'refused', reason: 'BAD_NAME' });
    expect(out.state).toEqual(state);
  });

  it('沒有確認：什麼都不改變', () => {
    const state = finished();
    const out = executeCommand(state, { type: 'legacy', name: '小禾', confirmed: false }, shippedIndex);
    expect(out.events).toContainEqual({ type: 'refused', reason: 'NOT_CONFIRMED' });
    expect(out.state).toEqual(state);
  });

  it('確認後：新角色接手，從第 1 年春天重新開始；圖鑑與成就保留；加成與收入歸零；代數加一', () => {
    const state = finished();
    const out = executeCommand(state, { type: 'legacy', name: '小禾', confirmed: true }, shippedIndex);
    const after = out.state;

    expect(out.events).not.toContainEqual(expect.objectContaining({ type: 'refused' }));
    expect(after.playerName).toBe('小禾');
    expect(after.generation).toBe(2);
    expect(after.calendar).toMatchObject({ year: 1, season: 'spring', day: 1 });
    expect(after.gold).toBe(shippedPack.start.gold);
    expect(after.story.chapter).toBe(1);
    expect(after.friendship).toEqual({});
    expect(after.mapId).toBe(shippedPack.start.mapId);
    expect(after.resetBonus).toBe(0);
    expect(after.yearlyIncome).toBe(0);
    expect(after.previousYearIncome).toBe(0);
    expect(after.collection.found).toContain('fish.carp');
    expect(after.collection.claimed).toEqual(['fish:25']);
    expect(after.achievements.unlocked).toContain('sprout-festival');
    expect(after.achievements.titles).toEqual(['修復委員']);
  });
});

describe('收入（yearlyIncome）', () => {
  it('睡醒時出貨箱的金幣計入本年收入', () => {
    const price = priceWithQuality(shippedIndex.item(CROP).sellPrice ?? 0, 'normal');
    const state = sleeper({ calendar: { year: 1, season: 'spring', day: 1, minuteOfDay: 360 } });
    const out = executeCommand(state, { type: 'interact' }, shippedIndex);
    expect(out.state.yearlyIncome).toBe(price);
    expect(out.state.previousYearIncome).toBe(0);
  });

  it('換年時：本年收入移到上一年，本年歸零', () => {
    const price = priceWithQuality(shippedIndex.item(CROP).sellPrice ?? 0, 'normal');
    const state = sleeper({ calendar: { year: 1, season: 'winter', day: 20, minuteOfDay: 360 }, yearlyIncome: 100 });
    const out = executeCommand(state, { type: 'interact' }, shippedIndex);
    expect(out.state.calendar.year).toBe(2);
    expect(out.state.previousYearIncome).toBe(100 + price);
    expect(out.state.yearlyIncome).toBe(0);
  });

  it('主線章節的獎勵金幣也計入本年收入', () => {
    const chapter = shippedPack.chapters?.find((c) => c.number === 1);
    const state = base({
      story: { chapter: 1 },
      flags: { 'talked:maomao': true, 'done:till': true, 'done:ship': true },
    });
    const out = settleStory(state, shippedIndex);
    expect(out.state.story.chapter).toBe(2);
    expect(out.state.yearlyIncome).toBe(chapter?.reward.gold ?? 0);
  });
});
