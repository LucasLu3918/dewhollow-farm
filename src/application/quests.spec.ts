import { describe, expect, it } from 'vitest';
import mineRulesJson from '../../content/mine.json';
import type { ContentPack } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { addItem, countOf, createInventory } from '../domain/inventory';
import { totalDay } from '../domain/calendar';
import type { BulletinRules } from '../domain/bulletin';
import type { QuestDef } from '../domain/quests';
import type { LetterDef } from '../domain/mail';
import { createContentIndex, type ContentIndex } from './content-index';
import { executeCommand, type Command, type CommandOutcome } from './game-commands';
import { currentBoard, questBoardView, recordQuestEvent, submitQuest } from './quests';

/**
 * M5b：居民委託（可接取條件、接取、進度、完成與獎勵）、佈告欄（今日抽取、接取）、信箱（早上送達、取信）。
 * 小地圖 village（7×4）：
 *   row0 #######
 *   row1 L.ffA.B      L 信箱 (0,1)；A 安的位置 (4,1)；B 佈告欄 (6,1)
 *   row2 ..b...D      b 床 (2,2)；D 門通往湖 (6,2)
 *   row3 #######
 */
const defs: QuestDef[] = [
  {
    id: 'ann-walk',
    kind: 'resident',
    title: '湖邊散步',
    giver: 'ann',
    request: '我想去湖邊看看，你能替我去一趟嗎？',
    thanks: '謝謝你替我看了湖。',
    goal: { type: 'visit', mapId: 'lake' },
    unlock: { hearts: { npcId: 'ann', hearts: 1 } },
    reward: { gold: 100, items: { egg: 2 }, friendship: 40, flag: 'ann:walked', fragments: 1 },
    phase: 'spring',
    playMinutes: 1.5,
  },
  {
    id: 'ann-stone',
    kind: 'resident',
    title: '借石頭',
    giver: 'ann',
    request: '院子的石頭不夠，能先給我三顆嗎？',
    thanks: '好重，謝謝你。',
    goal: { type: 'deliver', itemId: 'stone', count: 3 },
    unlock: { hearts: { npcId: 'ann', hearts: 1 } },
    reward: { gold: 80 },
    phase: 'spring',
    playMinutes: 1.5,
  },
  {
    id: 'ann-friend',
    kind: 'resident',
    title: '熟起來',
    giver: 'ann',
    request: '我們熟一點吧。',
    thanks: '很高興認識你。',
    goal: { type: 'hearts', npcId: 'ann', hearts: 2 },
    reward: { gold: 50 },
    phase: 'spring',
    playMinutes: 1.5,
  },
  {
    id: 'daily-ship',
    kind: 'daily',
    title: '出貨幫忙',
    request: '出貨箱快滿了，請幫忙出貨兩件。',
    thanks: '出貨箱清空了，謝謝。',
    goal: { type: 'ship', count: 2 },
    reward: { gold: 60 },
    phase: 'spring',
    playMinutes: 1,
  },
  {
    id: 'daily-fish',
    kind: 'daily',
    title: '來條鯉魚',
    request: '湖裡的鯉魚最近很搶手，請釣一條。',
    thanks: '好鮮，謝謝你。',
    goal: { type: 'fish', fishId: 'carp', count: 1 },
    reward: { gold: 40 },
    phase: 'spring',
    playMinutes: 1,
  },
  {
    id: 'weekly-tea',
    kind: 'weekly',
    title: '一壺薄荷茶',
    request: '鎮上的茶會需要一壺薄荷茶。',
    thanks: '茶會很成功。',
    goal: { type: 'cook', recipeId: 'mint-tea', count: 1 },
    reward: { gold: 300, fragments: 1 },
    phase: 'spring',
    playMinutes: 2,
  },
];

const bulletin: BulletinRules = { postedBy: '鎮公所', dailyCount: 2, daily: ['daily-ship', 'daily-fish'], weekly: ['weekly-tea'] };

const letters: LetterDef[] = [
  {
    id: 'ann-letter',
    from: 'ann',
    title: '安的信',
    body: ['最近天氣很好。', '有空來坐坐。'],
    phase: 'spring',
    playMinutes: 0.5,
    due: { season: 'spring', day: 2 },
    unlock: { hearts: { npcId: 'ann', hearts: 1 } },
  },
];

const content: ContentPack = {
  crops: [{ id: 'sweet-radish', name: '甜蘿蔔', seedPrice: 20, growthDays: 3, seasons: ['spring', 'summer'] }],
  npcs: [{ id: 'ann', name: '安', lines: ['早安。'], loves: [], hates: [], playMinutes: 2 }],
  schedule: {
    periods: { noon: 720, evening: 1020 },
    entries: [
      { npcId: 'ann', period: 'morning', mapId: 'village', x: 4, y: 1 },
      { npcId: 'ann', period: 'noon', mapId: 'village', x: 4, y: 1 },
      { npcId: 'ann', period: 'evening', mapId: 'village', x: 4, y: 1 },
    ],
  },
  heartEvents: [],
  friendship: {
    pointsPerHeart: 100,
    maxHearts: 10,
    earlyCap: { hearts: 4, untilSeason: 'summer' },
    talkPoints: 10,
    gift: { love: 80, neutral: 30, hate: -40 },
    cropQuality: { minHearts: 2, perResident: 0.05, cap: 0.15 },
  },
  quests: { defs, bulletin },
  letters,
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
  recipes: [{ id: 'mint-tea', name: '薄荷茶', ingredients: {}, energy: 1, level: 0, sellPrice: 10 }],
  animals: [],
  fish: [{ id: 'carp', name: '鯉魚', sellPrice: 30, seasons: ['spring', 'summer'], weight: 1 }],
  items: [
    { id: 'stone', name: '石頭', kind: 'material', maxStack: 99 },
    { id: 'wood', name: '木材', kind: 'material', maxStack: 99 },
    { id: 'egg', name: '雞蛋', kind: 'animal', maxStack: 99, sellPrice: 25 },
  ],
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
      width: 7,
      height: 4,
      rows: ['#######', 'L.ffA.B', '..b...D', '#######'],
      legend: {
        '#': { kind: 'wall' },
        '.': { kind: 'grass' },
        f: { kind: 'field' },
        A: { kind: 'grass' },
        L: { kind: 'furniture', notice: 'mailbox' },
        B: { kind: 'furniture', notice: 'bulletin' },
        b: { kind: 'bed' },
        D: { kind: 'door', to: 'lake', spawn: { x: 1, y: 1 } },
      },
      spawn: { x: 1, y: 2 },
    },
    {
      id: 'lake',
      name: '湖',
      width: 3,
      height: 3,
      rows: ['###', '...', '###'],
      legend: { '#': { kind: 'wall' }, '.': { kind: 'grass' } },
      spawn: { x: 1, y: 1 },
    },
  ],
};

const index: ContentIndex = createContentIndex(content);

/** 基礎狀態：村莊裡，玩家站在 (5,1) 面向佈告欄（右）；背包 8 格。 */
function base(overrides: Partial<GameState> = {}): GameState {
  const state = createNewGame(content, 7);
  return {
    ...state,
    mapId: 'village',
    player: { x: 5, y: 1, facing: 'right' },
    weather: 'sunny',
    forecast: 'sunny',
    ...overrides,
  };
}

function withFriendship(state: GameState, points: number): GameState {
  return { ...state, friendship: { ann: { points, talkedDay: null, giftedDay: null } } };
}

function withItems(state: GameState, items: Record<string, number>, capacity = 8): GameState {
  let inventory = createInventory(capacity);
  for (const [itemId, count] of Object.entries(items)) {
    const added = addItem(inventory, index.item(itemId), count);
    if (added.ok) inventory = added.value;
  }
  return { ...state, inventory };
}

function run(state: GameState, command: Command): CommandOutcome {
  return executeCommand(state, command, index);
}

function today(state: GameState): number {
  return totalDay(state.calendar, index.tuning.time.daysPerSeason);
}

describe('居民委託的可接取條件與接取', () => {
  it('好感不夠時居民委託不開放，接取會被拒絕', () => {
    const state = base();
    const out = run(state, { type: 'acceptQuest', questId: 'ann-stone' });
    expect(out.state.quests['ann-stone']).toBeUndefined();
    expect(out.messages).toEqual(['這個委託還沒開放']);
  });

  it('好感夠了才開放；接取後變成進行中，不能重複接取', () => {
    const open = withFriendship(base(), 100);
    const accepted = run(open, { type: 'acceptQuest', questId: 'ann-stone' }).state;
    expect(accepted.quests['ann-stone']).toEqual({ status: 'active', progress: 0, seen: [] });
    const again = run(accepted, { type: 'acceptQuest', questId: 'ann-stone' });
    expect(again.messages).toEqual(['這個委託已經接了']);
  });

  it('找不到的委託 id 給出明確的訊息', () => {
    expect(run(base(), { type: 'acceptQuest', questId: 'nope' }).messages).toEqual(['沒有這個委託']);
  });

  it('委託面板只列出已開放的居民委託與今天佈告欄上的委託（沒有條件的居民委託一開始就開放）', () => {
    const closed = questBoardView(base(), index).map((e) => e.def.id);
    expect(closed).toEqual(['ann-friend', 'daily-ship', 'daily-fish', 'weekly-tea']);
    const open = questBoardView(withFriendship(base(), 100), index).map((e) => e.def.id);
    expect(open).toEqual(['ann-walk', 'ann-stone', 'ann-friend', 'daily-ship', 'daily-fish', 'weekly-tea']);
  });
});

describe('佈告欄', () => {
  it('站在佈告欄前按 X 會打開佈告欄，並把今天的抽取更新進狀態', () => {
    const out = run(base(), { type: 'interact' });
    expect(out.events).toEqual([{ type: 'bulletinOpened' }]);
    expect(out.state.board.day).toBe(today(base()));
    expect(out.state.board.daily.sort()).toEqual([...bulletin.daily].sort());
  });

  it('可以接取今天佈告欄上的大委託', () => {
    const state = base();
    expect(currentBoard(state, index).weekly).toBe('weekly-tea');
    const accepted = run(state, { type: 'acceptQuest', questId: 'weekly-tea' });
    expect(accepted.state.quests['weekly-tea']?.status).toBe('active');
  });

  it('佈告欄的委託做完後，同一張委託之後還能再接（居民委託不行）', () => {
    const pending = withFriendship(base(), 400);
    const accepted = run(pending, { type: 'acceptQuest', questId: 'daily-fish' }).state;
    const done = run({ ...accepted, tool: 'rod', fishing: { fishId: 'carp' } }, { type: 'reel', hit: true }).state;
    expect(done.quests['daily-fish']?.status).toBe('done');
    const again = run(done, { type: 'acceptQuest', questId: 'daily-fish' }).state;
    expect(again.quests['daily-fish']).toEqual({ status: 'active', progress: 0, seen: [] });
    const resident = { ...done, quests: { ...done.quests, 'ann-friend': { status: 'done' as const, progress: 0, seen: [] } } };
    expect(run(resident, { type: 'acceptQuest', questId: 'ann-friend' }).messages).toEqual(['這個委託已經完成了']);
  });
});

describe('進度與完成', () => {
  it('釣到指定的魚會推進委託，完成後給金幣並從進行中移除', () => {
    const state = { ...base(), tool: 'rod' as const, fishing: { fishId: 'carp' } };
    const accepted = run(state, { type: 'acceptQuest', questId: 'daily-fish' }).state;
    const out = run({ ...accepted, fishing: { fishId: 'carp' } }, { type: 'reel', hit: true });
    expect(out.state.gold).toBe(state.gold + 40);
    expect(out.state.quests['daily-fish']?.status).toBe('done');
    expect(out.messages).toEqual(['釣到了鯉魚', '委託完成：來條鯉魚', '好鮮，謝謝你。', '獲得 40 金']);
  });

  it('拜訪地點：走進湖畔後完成，獎勵金幣、物品、好感、旗標與圖鑑碎片', () => {
    const ready = withFriendship({ ...base({ player: { x: 5, y: 2, facing: 'right' } }) }, 100);
    const accepted = run(ready, { type: 'acceptQuest', questId: 'ann-walk' }).state;
    const out = run(accepted, { type: 'move', direction: 'right' });
    expect(out.state.mapId).toBe('lake');
    expect(out.state.quests['ann-walk']?.status).toBe('done');
    expect(out.state.gold).toBe(ready.gold + 100);
    expect(countOf(out.state.inventory, 'egg')).toBe(2);
    expect(out.state.friendship.ann?.points).toBe(140);
    expect(out.state.flags['ann:walked']).toBe(true);
    expect(out.state.dexFragments).toBe(1);
  });

  it('好感達到目標時，任何指令之後都會自動完成（目標已經達到的委託，接取的那一刻就完成）', () => {
    const accepted = run(withFriendship(base(), 100), { type: 'acceptQuest', questId: 'ann-friend' }).state;
    expect(accepted.quests['ann-friend']?.status).toBe('active');
    const reached = { ...accepted, friendship: { ann: { points: 200, talkedDay: null, giftedDay: null } } };
    const out = run(reached, { type: 'move', direction: 'left' });
    expect(out.state.quests['ann-friend']?.status).toBe('done');
    expect(out.state.gold).toBe(accepted.gold + 50);
    expect(run(withFriendship(base(), 200), { type: 'acceptQuest', questId: 'ann-friend' }).state.gold).toBe(base().gold + 50);
  });

  it('交付物品：數量不夠時不能交付；夠了才扣除物品並完成', () => {
    const accepted = run(withFriendship(base(), 100), { type: 'acceptQuest', questId: 'ann-stone' }).state;
    const short = withItems(accepted, { stone: 2 });
    const refused = submitQuest(short, 'ann-stone', index);
    expect(refused.ok).toBe(false);
    expect(run(short, { type: 'submitQuest', questId: 'ann-stone' }).messages[0]).toContain('還差 石頭 × 1');

    const enough = withItems(accepted, { stone: 3 });
    const out = run(enough, { type: 'submitQuest', questId: 'ann-stone' });
    expect(countOf(out.state.inventory, 'stone')).toBe(0);
    expect(out.state.gold).toBe(enough.gold + 80);
    expect(out.state.quests['ann-stone']?.status).toBe('done');
  });

  it('背包放不下獎勵時，委託保持進行中，騰出空間後的下一個指令才完成', () => {
    const full = withItems(withFriendship(base(), 100), { stone: 1 }, 1);
    const accepted = run(full, { type: 'acceptQuest', questId: 'ann-walk' }).state;
    const walked = run({ ...accepted, player: { x: 5, y: 2, facing: 'right' } }, { type: 'move', direction: 'right' }).state;
    expect(walked.mapId).toBe('lake');
    expect(walked.quests['ann-walk']?.status).toBe('active');
    const cleared = { ...walked, inventory: createInventory(1) };
    const settled = run(cleared, { type: 'move', direction: 'left' }).state;
    expect(settled.quests['ann-walk']?.status).toBe('done');
    expect(countOf(settled.inventory, 'egg')).toBe(2);
  });

  it('recordQuestEvent 只推進進行中的委託', () => {
    const accepted = run(withFriendship(base(), 100), { type: 'acceptQuest', questId: 'ann-stone' }).state;
    const same = recordQuestEvent(accepted, { type: 'ship', itemId: 'stone', count: 5 }, index);
    expect(same.quests['ann-stone']?.progress).toBe(0);
    const none = recordQuestEvent(base(), { type: 'ship', itemId: 'stone', count: 5 }, index);
    expect(none.quests).toEqual({});
  });
});

describe('信箱', () => {
  it('睡覺後到期且條件符合的信送進信箱（未讀），並在訊息中提到信箱', () => {
    const ready = withFriendship(base({ player: { x: 3, y: 2, facing: 'left' } }), 100);
    const out = run(ready, { type: 'interact' });
    expect(out.state.calendar.day).toBe(2);
    expect(out.state.mail).toEqual({ 'ann-letter': 'unread' });
    expect(out.messages.some((m) => m.includes('信箱'))).toBe(true);
  });

  it('站在信箱前按 X 取信：信件內容顯示出來，狀態變成已讀；沒有未讀時說明信箱是空的', () => {
    const state = { ...base({ player: { x: 0, y: 2, facing: 'up' } }), mail: { 'ann-letter': 'unread' as const } };
    const out = run(state, { type: 'interact' });
    expect(out.state.mail).toEqual({ 'ann-letter': 'read' });
    expect(out.messages).toEqual(['【安的信】', '最近天氣很好。', '有空來坐坐。']);
    expect(run(out.state, { type: 'interact' }).messages).toEqual(['信箱是空的']);
  });
});
