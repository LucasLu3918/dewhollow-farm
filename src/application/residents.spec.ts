import { describe, expect, it } from 'vitest';
import mineRulesJson from '../../content/mine.json';
import type { ContentPack } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { addItem, countOf, createInventory } from '../domain/inventory';
import { cropItemId } from '../domain/items';
import { plotKey } from '../domain/farm';
import { createContentIndex, type ContentIndex } from './content-index';
import { executeCommand, type Command, type CommandOutcome } from './game-commands';
import { residentsOn } from './residents';
import { totalDay } from '../domain/calendar';

/**
 * M5a：居民的位置（行程）、說話與每日好感、送禮、心形事件（待處理、選項、只觸發一次），以及作物品質加成。
 * 小地圖 village（5×3）：
 *   row0 #####
 *   row1 .ffA.     （f 田 (1,1)(2,1)；安的行程在 (3,1)）
 *   row2 ...T.     （玩家站 (3,2) 面向上找安；本的行程在 (4,2)）
 */
const content: ContentPack = {
  crops: [{ id: 'sweet-radish', name: '甜蘿蔔', seedPrice: 20, growthDays: 3, seasons: ['spring', 'summer'] }],
  npcs: [
    { id: 'ann', name: '安', lines: ['早安。', '今天也辛苦了。'], loves: ['crop.sweet-radish'], hates: ['stone'], playMinutes: 2 },
    { id: 'ben', name: '本', lines: ['你好。'], loves: [], hates: [], playMinutes: 2 },
  ],
  schedule: {
    periods: { noon: 720, evening: 1020 },
    entries: [
      { npcId: 'ann', period: 'morning', mapId: 'village', x: 3, y: 1 },
      { npcId: 'ann', period: 'noon', mapId: 'village', x: 3, y: 1 },
      { npcId: 'ann', period: 'noon', weather: ['rain'], mapId: 'village', x: 0, y: 2 },
      { npcId: 'ann', period: 'evening', mapId: 'village', x: 3, y: 1 },
      { npcId: 'ben', period: 'morning', mapId: 'village', x: 4, y: 2 },
      { npcId: 'ben', period: 'noon', mapId: 'village', x: 4, y: 2 },
      { npcId: 'ben', period: 'evening', mapId: 'village', x: 4, y: 2 },
    ],
  },
  heartEvents: [
    {
      id: 'ann-heart-1',
      npcId: 'ann',
      hearts: 2,
      phase: 'spring',
      mapId: 'village',
      periods: ['morning'],
      emote: 'heart',
      pages: ['安抬起頭。', '「今天的天氣真好。」'],
      options: [
        { id: 'a', label: '是呀', reply: '安笑了。', points: 30 },
        { id: 'b', label: '還好', reply: '安聳聳肩。', points: -10 },
      ],
      playMinutes: 2.5,
    },
  ],
  friendship: {
    pointsPerHeart: 100,
    maxHearts: 10,
    earlyCap: { hearts: 4, untilSeason: 'summer' },
    talkPoints: 10,
    gift: { love: 80, neutral: 30, hate: -40 },
    cropQuality: { minHearts: 2, perResident: 0.05, cap: 0.15 },
  },
  start: { mapId: 'village', gold: 100, seeds: {} },
  tuning: {
    energy: { max: 20, costs: { till: 2, water: 1, plant: 1, harvest: 1, ship: 0, chop: 3, forage: 1, mine: 2, fish: 2, cook: 1, process: 1 } },
    inventory: { capacity: 8 },
    harvest: { min: 1, max: 1 },
    time: { wakeMinute: 360, minutesPerAction: 10, daysPerSeason: 20 },
    tools: { tiers: [{ energyDiscount: 0 }, { energyDiscount: 1 }, { energyDiscount: 1 }, { energyDiscount: 2 }] },
    fishing: { biteChance: 60, bobberBonus: 10, baitBonus: 20 },
    fertilizer: { basic: { goodBonus: 20, fineBonus: 0 }, fine: { goodBonus: 30, fineBonus: 15 } },
    processing: { slots: 3 },
    skills: { thresholds: [0, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650], xp: { till: 2, water: 1, plant: 2, harvest: 4, chop: 4, forage: 3, mine: 4 }, bonusFrom: 5, goodFrom: 4, goodChance: 0.2, fineFrom: 8, fineChance: 0.08 },
    gathering: { wood: { min: 1, max: 3 }, forage: { min: 1, max: 2 }, stone: { min: 1, max: 2 }, ore: { min: 1, max: 2 } },
  },
  crafting: [],
  talents: { unlockLevel: 5, defs: [] },
  mine: mineRulesJson,
  processing: [],
  recipes: [],
  animals: [],
  fish: [],
  items: [{ id: 'stone', name: '石頭', kind: 'material', maxStack: 99 }],
  shops: [],
  weather: {
    spring: [{ weather: 'sunny', weight: 1 }],
    summer: [{ weather: 'sunny', weight: 1 }],
    autumn: [{ weather: 'sunny', weight: 1 }],
    winter: [{ weather: 'snow', weight: 1 }],
  },
  maps: [
    {
      id: 'village',
      name: '村莊',
      width: 5,
      height: 3,
      rows: ['#####', '.ffA.', '...T.'],
      legend: {
        '#': { kind: 'wall' },
        '.': { kind: 'grass' },
        f: { kind: 'field' },
        A: { kind: 'grass' },
        T: { kind: 'grass' },
      },
      spawn: { x: 1, y: 2 },
    },
  ],
};

const index: ContentIndex = createContentIndex(content);

/** 玩家站在 (3,2) 面向上，正對安（3,1）；背包裡有兩株甜蘿蔔。 */
function base(overrides: Partial<GameState> = {}): GameState {
  const state = createNewGame(content, 7);
  let inventory = createInventory(8);
  const added = addItem(inventory, index.item(cropItemId('sweet-radish')), 2, 'normal');
  if (added.ok) inventory = added.value;
  return {
    ...state,
    mapId: 'village',
    player: { x: 3, y: 2, facing: 'up' },
    weather: 'sunny',
    forecast: 'sunny',
    inventory,
    ...overrides,
  };
}

function run(state: GameState, command: Command): CommandOutcome {
  return executeCommand(state, command, index);
}

function dayOf(state: GameState, day: number): GameState {
  return { ...state, calendar: { ...state.calendar, day } };
}

describe('居民的位置', () => {
  it('只列出目前地圖、目前時段與天氣下有行程的居民', () => {
    const state = base();
    expect(residentsOn(state, index)).toEqual([
      { npcId: 'ann', x: 3, y: 1 },
      { npcId: 'ben', x: 4, y: 2 },
    ]);
    expect(residentsOn({ ...state, mapId: 'elsewhere' }, index)).toEqual([]);
  });

  it('下雨時用雨天的行程（有天氣條件的行程優先）', () => {
    const state = base({ weather: 'rain', calendar: { ...base().calendar, minuteOfDay: 800 } });
    expect(residentsOn(state, index).find((r) => r.npcId === 'ann')).toEqual({ npcId: 'ann', x: 0, y: 2 });
  });

  it('居民站的格子擋住玩家：不能走進去', () => {
    const state = base({ player: { x: 3, y: 2, facing: 'left' } });
    const outcome = run(state, { type: 'move', direction: 'up' });
    expect(outcome.state.player).toEqual({ x: 3, y: 2, facing: 'up' });
  });
});

describe('說話與每日好感', () => {
  it('每天第一次對話加好感，同一天再說話不再加', () => {
    const first = run(base(), { type: 'interact' }).state;
    expect(first.friendship.ann?.points).toBe(10);
    expect(first.friendship.ann?.talkedDay).toBe(totalDay(first.calendar, 20));
    const again = run(first, { type: 'interact' }).state;
    expect(again.friendship.ann?.points).toBe(10);
  });

  it('隔天再說話又會加好感', () => {
    const day1 = run(base(), { type: 'interact' }).state;
    const day2 = run(dayOf(day1, 2), { type: 'interact' }).state;
    expect(day2.friendship.ann?.points).toBe(20);
  });

  it('說話不花體力與時間', () => {
    const state = base();
    const after = run(state, { type: 'interact' }).state;
    expect(after.energy).toEqual(state.energy);
    expect(after.calendar).toEqual(state.calendar);
  });
});

describe('送禮', () => {
  it('送喜歡的東西：好感 +80，物品少一個，今天不能再送同一人', () => {
    const given = run(base(), { type: 'giveGift', npcId: 'ann', itemId: cropItemId('sweet-radish') });
    expect(given.state.friendship.ann?.points).toBe(80);
    expect(countOf(given.state.inventory, cropItemId('sweet-radish'))).toBe(1);
    expect(given.state.friendship.ann?.giftedDay).toBe(totalDay(given.state.calendar, 20));
    const again = run(given.state, { type: 'giveGift', npcId: 'ann', itemId: cropItemId('sweet-radish') });
    expect(again.messages.join()).toContain('今天已經送過禮');
    expect(again.state.friendship.ann?.points).toBe(80);
  });

  it('送討厭的東西：好感 −40（不低於 0），中立的東西 +30', () => {
    const withStone = base({ friendship: { ann: { points: 100, talkedDay: null, giftedDay: null } } });
    const inventory = addItem(withStone.inventory, index.item('stone'), 1, 'normal');
    if (!inventory.ok) throw new Error('背包放不下石頭');
    const hated = run({ ...withStone, inventory: inventory.value }, { type: 'giveGift', npcId: 'ann', itemId: 'stone' });
    expect(hated.state.friendship.ann?.points).toBe(60);

    // 本在 (4,2)：玩家站在 (3,2) 面向右。
    const neutral = run(base({ player: { x: 3, y: 2, facing: 'right' } }), { type: 'giveGift', npcId: 'ben', itemId: cropItemId('sweet-radish') });
    expect(neutral.state.friendship.ben?.points).toBe(30);
  });

  it('要站在居民面前（面向他）才能送禮，否則不花東西也不改好感', () => {
    const away = run(base({ player: { x: 1, y: 2, facing: 'up' } }), { type: 'giveGift', npcId: 'ann', itemId: cropItemId('sweet-radish') });
    expect(away.messages.join()).toContain('站在居民面前');
    expect(away.state.friendship.ann).toBeUndefined();
    expect(countOf(away.state.inventory, cropItemId('sweet-radish'))).toBe(2);
  });
});

describe('心形事件', () => {
  const twoHearts = base({ friendship: { ann: { points: 200, talkedDay: null, giftedDay: null } } });

  it('好感到 2 顆心、在地點與時段都符合時，說話會觸發事件，並記下來', () => {
    const outcome = run(twoHearts, { type: 'interact' });
    expect(outcome.state.pendingHeartEvent).toBe('ann-heart-1');
    expect(outcome.state.heartEvents).toEqual(['ann-heart-1']);
    expect(outcome.events.some((e) => e.type === 'heartEvent' && e.eventId === 'ann-heart-1')).toBe(true);
  });

  it('事件還沒選完時，其他指令都被擋下', () => {
    const pending = run(twoHearts, { type: 'interact' }).state;
    const moved = run(pending, { type: 'move', direction: 'left' });
    expect(moved.state.player).toEqual(pending.player);
    expect(moved.messages.join()).toContain('對話看完');
  });

  it('選了選項：好感依選項變化，事件結束', () => {
    const pending = run(twoHearts, { type: 'interact' }).state;
    const done = run(pending, { type: 'chooseHeartOption', optionId: 'a' });
    expect(done.state.pendingHeartEvent).toBeNull();
    expect(done.state.friendship.ann?.points).toBe(240);
    expect(done.messages).toContain('安笑了。');
  });

  it('沒有這個選項時不做任何事', () => {
    const pending = run(twoHearts, { type: 'interact' }).state;
    const bad = run(pending, { type: 'chooseHeartOption', optionId: 'nope' });
    expect(bad.state.pendingHeartEvent).toBe('ann-heart-1');
  });

  it('同一個事件只觸發一次：選完之後，就算又說話也不會再觸發', () => {
    const done = run(run(twoHearts, { type: 'interact' }).state, { type: 'chooseHeartOption', optionId: 'a' }).state;
    const later = run(dayOf(done, 2), { type: 'interact' });
    expect(later.state.pendingHeartEvent).toBeNull();
    expect(later.state.heartEvents).toEqual(['ann-heart-1']);
  });

  it('好感不到 2 顆心，或時段不對，就不觸發', () => {
    const low = run(base({ friendship: { ann: { points: 150, talkedDay: null, giftedDay: null } } }), { type: 'interact' });
    expect(low.state.pendingHeartEvent).toBeNull();
    const evening = run({ ...twoHearts, calendar: { ...twoHearts.calendar, minuteOfDay: 1100 } }, { type: 'interact' });
    expect(evening.state.pendingHeartEvent).toBeNull();
  });
});

describe('收成品質：居民喜歡的作物', () => {
  /** 收成一株已經成熟的蘿蔔（玩家站在田的旁邊，面向田）。 */
  function harvestWith(seed: number, friendship: GameState['friendship']): GameState {
    const state = createNewGame(content, seed);
    return executeCommand(
      {
        ...state,
        mapId: 'village',
        player: { x: 1, y: 2, facing: 'up' },
        weather: 'sunny',
        energy: { ...state.energy, current: 20 },
        skills: { ...state.skills, farming: 140 },
        plots: { [plotKey(1, 1)]: { watered: true, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 3 }, fertilizer: undefined } },
        friendship,
      },
      { type: 'interact' },
      index,
    ).state;
  }

  it('有喜歡這種作物、好感到門檻的居民，優良與精良的機率會變高', () => {
    const seeds = Array.from({ length: 300 }, (_, i) => i + 1);
    const better = (friendship: GameState['friendship']): number =>
      seeds.filter((seed) => {
        const after = harvestWith(seed, friendship);
        return after.inventory.stacks.some((s) => s.itemId === cropItemId('sweet-radish') && s.quality !== 'normal');
      }).length;
    const without = better({});
    const withLove = better({ ann: { points: 200, talkedDay: null, giftedDay: null } });
    expect(withLove).toBeGreaterThan(without);
  });

  it('好感不到門檻，不影響品質', () => {
    const seeds = Array.from({ length: 300 }, (_, i) => i + 1);
    const count = (friendship: GameState['friendship']): number =>
      seeds.filter((seed) => harvestWith(seed, friendship).inventory.stacks.some((s) => s.quality !== 'normal')).length;
    expect(count({ ann: { points: 100, talkedDay: null, giftedDay: null } })).toBe(count({}));
  });

});
