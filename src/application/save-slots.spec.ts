import { describe, expect, it } from 'vitest';
import crops from '../../content/crops.json';
import mine from '../../content/mine.json';
import npcs from '../../content/npcs.json';
import start from '../../content/start.json';
import tuning from '../../content/tuning.json';
import assets from '../../content/assets.json';
import rigs from '../../content/rigs.json';
import companions from '../../content/companions.json';
import tools from '../../content/tools.json';
import sounds from '../../content/sounds.json';
import music from '../../content/music.json';
import terrain from '../../content/terrain.json';
import weather from '../../content/weather.json';
import items from '../../content/items.json';
import shops from '../../content/shops.json';
import fish from '../../content/fish.json';
import animals from '../../content/animals.json';
import recipes from '../../content/recipes.json';
import processing from '../../content/processing.json';
import crafting from '../../content/crafting.json';
import talents from '../../content/talents.json';
import farm from '../../content/maps/farm.json';
import village from '../../content/maps/village.json';
import forest from '../../content/maps/forest.json';
import lake from '../../content/maps/lake.json';
import house from '../../content/maps/house.json';
import mineEntrance from '../../content/maps/mine-entrance.json';
import coop from '../../content/maps/coop.json';
import pasture from '../../content/maps/pasture.json';
import cowbarn from '../../content/maps/cowbarn.json';
import plaza from '../../content/maps/plaza.json';
import schedules from '../../content/schedules.json';
import events from '../../content/events.json';
import friendship from '../../content/friendship.json';
import quests from '../../content/quests.json';
import letters from '../../content/letters.json';
import festivals from '../../content/festivals.json';
import mainQuest from '../../content/main-quest.json';
import repairs from '../../content/repairs.json';
import randomEvents from '../../content/events-random.json';
import { loadContent } from '../infrastructure/content/load-content';
import { parseSaveRecord } from '../infrastructure/persistence/save-schema';
import { SaveFormatError } from '../infrastructure/persistence/save-errors';
import { createNewGame } from '../domain/game-state';
import type { SaveRecord, SaveRepository } from './ports';
import { createContentIndex } from './content-index';
import { DEFAULT_SLOT } from './game-session';
import { farmRating } from './rating';
import {
  exportFileName,
  isSaveSlot,
  SAVE_SLOTS,
  SaveSlotService,
  slotActions,
  slotFromQuery,
  summarizeRecord,
} from './save-slots';

const { pack } = loadContent({ crops, npcs, schedules, events, friendship, quests, letters, festivals, mainQuest, repairs, randomEvents, maps: [farm, village, plaza, forest, lake, house, mineEntrance, coop, pasture, cowbarn], start, tuning, assets, rigs, companions, tools, sounds, music, terrain, weather, items, shops, fish, animals, recipes, processing, crafting, talents, mine });
const index = createContentIndex(pack);
const migration = { inventoryCapacity: pack.tuning.inventory.capacity, daysPerSeason: pack.tuning.time.daysPerSeason, wakeMinute: pack.tuning.time.wakeMinute, playerName: '小涵' };
const rating = { rating: index.rating, dexCategories: index.dexCategories, npcIds: index.npcs.map((n) => n.id), friendship: index.friendship };
const VERSION = '0.1.0';

/** 測試用的記憶體倉庫：記下每一次寫入，方便確認「驗證失敗時不寫入」。 */
function spyRepository(initial: Record<string, SaveRecord> = {}) {
  const records = new Map<string, SaveRecord>(Object.entries(initial));
  const writes: SaveRecord[] = [];
  const repository: SaveRepository = {
    load: async (slot) => records.get(slot) ?? null,
    save: async (record) => {
      writes.push(record);
      records.set(record.slot, record);
    },
    delete: async (slot) => {
      records.delete(slot);
    },
  };
  return { repository, records, writes };
}

function serviceWith(repository: SaveRepository): SaveSlotService {
  return new SaveSlotService({
    repository,
    parse: (raw) => parseSaveRecord(raw, migration),
    rating,
    gameVersion: VERSION,
  });
}

function currentRecord(slot: string, overrides: Record<string, unknown> = {}): SaveRecord {
  return { slot, savedAt: '2026-10-22T08:00:00.000Z', gameVersion: VERSION, state: { ...createNewGame(pack, 1), ...overrides } };
}

const V1_STATE = {
  schemaVersion: 1,
  calendar: { year: 1, season: 'spring', day: 2, minuteOfDay: 360 },
  energy: { current: 100, max: 100 },
  gold: 100,
  mapId: 'farm',
  player: { x: 7, y: 9, facing: 'down' },
  plots: {},
  bag: { seeds: { 'moon-bean': 2 }, crops: {} },
  shipBox: { items: {} },
  flags: {},
  tool: 'hoe',
  selectedSeed: 'moon-bean',
  rng: 7,
};

describe('存檔槽的編號與查詢', () => {
  it('提供三個存檔槽，預設仍是 slot-1', () => {
    expect([...SAVE_SLOTS]).toEqual(['slot-1', 'slot-2', 'slot-3']);
    expect(DEFAULT_SLOT).toBe('slot-1');
  });

  it('只認得三個存檔槽的編號', () => {
    expect(isSaveSlot('slot-2')).toBe(true);
    expect(isSaveSlot('slot-4')).toBe(false);
    expect(isSaveSlot(null)).toBe(false);
  });

  it('網址沒有槽位或槽位不合法時，回到 slot-1', () => {
    expect(slotFromQuery('')).toBe('slot-1');
    expect(slotFromQuery('?slot=slot-3')).toBe('slot-3');
    expect(slotFromQuery('?slot=slot-9')).toBe('slot-1');
    expect(slotFromQuery('?slot=../etc')).toBe('slot-1');
  });
});

describe('槽位摘要（只讀）', () => {
  it('沒有存檔的槽位是空白', async () => {
    const { repository } = spyRepository();
    const list = await serviceWith(repository).list();
    expect(list.map((s) => s.status)).toEqual(['empty', 'empty', 'empty']);
  });

  it('有存檔的槽位讀出角色名字、年季日、金幣、評級與存檔時間，而且不改動存檔', async () => {
    const record = currentRecord('slot-2', { gold: 321, playerName: '小禾' });
    const { repository, writes } = spyRepository({ 'slot-2': record });
    const before = structuredClone(record);

    const list = await serviceWith(repository).list();
    const summary = list[1];
    expect(summary).toMatchObject({
      slot: 'slot-2',
      status: 'ready',
      playerName: '小禾',
      dateText: '第 1 年 春 第 1 天',
      gold: 321,
      savedAt: '2026-10-22T08:00:00.000Z',
      gameVersion: VERSION,
    });
    expect(summary).toHaveProperty('grade', farmRating(record.state, rating).grade);
    expect(summarizeRecord('slot-2', record, rating)).toMatchObject({ slot: 'slot-2', status: 'ready', playerName: '小禾' });
    expect(writes).toHaveLength(0);
    expect(record).toEqual(before);
  });

  it('損毀的存檔顯示真實錯誤，原檔保留，不會被覆寫', async () => {
    const broken = new SaveFormatError('存檔內容格式錯誤於 tool：Invalid literal');
    const writes: SaveRecord[] = [];
    const repository: SaveRepository = {
      load: async (slot) => {
        if (slot === 'slot-3') throw broken;
        return null;
      },
      save: async (record) => {
        writes.push(record);
      },
      delete: async () => {},
    };
    const list = await serviceWith(repository).list();
    expect(list[2]).toMatchObject({ slot: 'slot-3', status: 'broken', message: broken.message });
    expect(writes).toHaveLength(0);
  });

  it('沒有 gameVersion 的舊存檔也能顯示，版本欄為 null（不視為錯誤）', async () => {
    const record = { slot: 'slot-1', savedAt: '2026-10-21T00:00:00.000Z', state: createNewGame(pack, 1) };
    const { repository } = spyRepository({ 'slot-1': record });
    const [first] = await serviceWith(repository).list();
    expect(first).toMatchObject({ status: 'ready', gameVersion: null });
  });
});

describe('刪除存檔', () => {
  it('刪除後該槽位回到空白', async () => {
    const { repository, records } = spyRepository({ 'slot-2': currentRecord('slot-2') });
    await serviceWith(repository).remove('slot-2');
    expect(records.has('slot-2')).toBe(false);
  });
});

describe('匯出', () => {
  it('檔名含槽位與日期', () => {
    expect(exportFileName('slot-2', new Date(2026, 9, 22, 12))).toBe('dewhollow-farm-slot-2-2026-10-22.json');
  });

  it('匯出的內容是版本號與存檔本身，欄位只有遊戲資料', async () => {
    const record = currentRecord('slot-2', { gold: 77 });
    const { repository } = spyRepository({ 'slot-2': record });
    const exported = await serviceWith(repository).exportSlot('slot-2', new Date(2026, 9, 22, 12));

    expect(exported.fileName).toBe('dewhollow-farm-slot-2-2026-10-22.json');
    const parsed = JSON.parse(exported.text) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(['gameVersion', 'savedAt', 'slot', 'state']);
    expect(parsed).toMatchObject({ slot: 'slot-2', savedAt: record.savedAt, gameVersion: VERSION });
    expect((parsed.state as { gold: number }).gold).toBe(77);
  });

  it('空白的槽位不能匯出，並說明原因', async () => {
    const { repository } = spyRepository();
    await expect(serviceWith(repository).exportSlot('slot-1', new Date())).rejects.toThrow('沒有存檔');
  });
});

describe('匯入的驗證', () => {
  it('正確的檔案通過驗證，並寫入指定的槽位', async () => {
    const exportRepo = spyRepository({ 'slot-1': currentRecord('slot-1', { gold: 555 }) });
    const exported = await serviceWith(exportRepo.repository).exportSlot('slot-1', new Date(2026, 9, 22));

    const target = spyRepository();
    const service = serviceWith(target.repository);
    const record = await service.readImport(exported.text);
    await service.importRecord('slot-3', record);

    const saved = target.records.get('slot-3');
    expect(saved?.slot).toBe('slot-3');
    expect((saved?.state as { gold: number }).gold).toBe(555);
    expect(saved?.gameVersion).toBe(VERSION);
  });

  it('不是 JSON 的檔案回報錯誤，而且不寫入', async () => {
    const { repository, writes } = spyRepository();
    await expect(serviceWith(repository).readImport('{ 壞掉的內容')).rejects.toThrow('不是有效的 JSON');
    expect(writes).toHaveLength(0);
  });

  it('結構錯誤的檔案回報出錯的欄位，而且不寫入', async () => {
    const bad = JSON.stringify({ slot: 'slot-1', savedAt: 'x', state: { ...createNewGame(pack, 1), gold: -5 } });
    const { repository, writes } = spyRepository();
    await expect(serviceWith(repository).readImport(bad)).rejects.toThrow('gold');
    expect(writes).toHaveLength(0);
  });

  it('來自更新版本的檔案（v25）被拒絕，並提示更新遊戲', async () => {
    const newer = JSON.stringify({ slot: 'slot-1', savedAt: 'x', state: { ...createNewGame(pack, 1), schemaVersion: 25 } });
    const { repository } = spyRepository();
    await expect(serviceWith(repository).readImport(newer)).rejects.toThrow(/更新版本/);
  });

  it('舊版（v1）的檔案照常遷移為目前版本', async () => {
    const v1 = JSON.stringify({ slot: 'slot-1', savedAt: '2026-10-20T10:00:00.000Z', state: V1_STATE });
    const { repository } = spyRepository();
    const record = await serviceWith(repository).readImport(v1);
    expect(record.state.schemaVersion).toBe(24);
    expect(record.state.inventory.stacks).toEqual([{ itemId: 'seed.moon-bean', quality: 'normal', count: 2 }]);
  });

  it('驗證失敗時不覆蓋目標槽位原有的存檔', async () => {
    const original = currentRecord('slot-2', { gold: 999 });
    const { repository, records, writes } = spyRepository({ 'slot-2': original });
    const service = serviceWith(repository);
    await expect(service.readImport('{"slot":"slot-1"}')).rejects.toThrow();
    expect(writes).toHaveLength(0);
    expect((records.get('slot-2')?.state as { gold: number }).gold).toBe(999);
  });
});

describe('每個槽位能做的事', () => {
  const empty = { slot: 'slot-2', status: 'empty' as const };
  const broken = { slot: 'slot-2', status: 'broken' as const, message: '損毀' };
  const ready = {
    slot: 'slot-2',
    status: 'ready' as const,
    playerName: '小涵',
    generation: 1,
    dateText: '第 1 年 春 第 1 天',
    gold: 0,
    grade: 'D',
    savedAt: '2026-10-22T00:00:00.000Z',
    gameVersion: VERSION,
  };

  it('空白且不是目前的槽位：可以開新遊戲或匯入', () => {
    expect(slotActions(empty, false)).toEqual(['new', 'import']);
  });

  it('空白且正在玩的槽位：只能匯入（新遊戲沒有意義）', () => {
    expect(slotActions(empty, true)).toEqual(['import']);
  });

  it('有存檔且不是目前的槽位：可以讀取、匯出、新遊戲、刪除與匯入', () => {
    expect(slotActions(ready, false)).toEqual(['load', 'export', 'new', 'delete', 'import']);
  });

  it('有存檔且正在玩的槽位：不能讀取自己，其餘照常', () => {
    expect(slotActions(ready, true)).toEqual(['export', 'new', 'delete', 'import']);
  });

  it('損毀的槽位不能讀取、匯出或直接開新遊戲（那會覆寫原檔），只能刪除或匯入', () => {
    expect(slotActions(broken, false)).toEqual(['delete', 'import']);
    expect(slotActions(broken, true)).toEqual(['delete', 'import']);
  });
});
