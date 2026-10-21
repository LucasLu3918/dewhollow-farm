import { describe, expect, it } from 'vitest';
import crops from '../../../content/crops.json';
import npcs from '../../../content/npcs.json';
import start from '../../../content/start.json';
import tuning from '../../../content/tuning.json';
import assets from '../../../content/assets.json';
import rigs from '../../../content/rigs.json';
import companions from '../../../content/companions.json';
import tools from '../../../content/tools.json';
import sounds from '../../../content/sounds.json';
import music from '../../../content/music.json';
import terrain from '../../../content/terrain.json';
import weather from '../../../content/weather.json';
import items from '../../../content/items.json';
import shops from '../../../content/shops.json';
import fish from '../../../content/fish.json';
import animals from '../../../content/animals.json';
import recipes from '../../../content/recipes.json';
import processing from '../../../content/processing.json';
import crafting from '../../../content/crafting.json';
import talents from '../../../content/talents.json';
import mine from '../../../content/mine.json';
import forest from '../../../content/maps/forest.json';
import lake from '../../../content/maps/lake.json';
import house from '../../../content/maps/house.json';
import mineEntrance from '../../../content/maps/mine-entrance.json';
import coop from '../../../content/maps/coop.json';
import pasture from '../../../content/maps/pasture.json';
import cowbarn from '../../../content/maps/cowbarn.json';
import farm from '../../../content/maps/farm.json';
import village from '../../../content/maps/village.json';
import plaza from '../../../content/maps/plaza.json';
import schedules from '../../../content/schedules.json';
import events from '../../../content/events.json';
import friendship from '../../../content/friendship.json';
import quests from '../../../content/quests.json';
import letters from '../../../content/letters.json';
import { PERIODS, spotOf, type ScheduleDef } from '../../domain/schedule';
import { WEATHERS } from '../../domain/weather';
import { tileAt, isWalkable } from '../../domain/world';
import type { ContentPack } from '../../domain/content';
import { loadContent, questProblems, residentProblems, type RawContentFiles } from './load-content';
import { drawBoard } from '../../domain/bulletin';

function shipped(): RawContentFiles {
  return {
    crops,
    npcs,
    maps: [farm, village, plaza, forest, lake, house, mineEntrance, coop, pasture, cowbarn],
    start,
    tuning,
    assets,
    rigs,
    companions,
    tools,
    sounds,
    music,
    terrain,
    weather,
    items,
    shops,
    fish,
    animals,
    recipes,
    processing,
    crafting,
    talents,
    mine,
    schedules,
    events,
    friendship,
    quests,
    letters,
  };
}

const { pack } = loadContent(shipped());

describe('居民內容（M5a，真實內容）', () => {
  it('載入六位居民、十二個心形事件與行程，且沒有交叉參照的問題', () => {
    expect(pack.npcs.map((n) => n.id)).toEqual(['maomao', 'rong-bo', 'a-gan', 'shi-shifu', 'zhi-lan', 'xiao-sui']);
    expect(pack.heartEvents).toHaveLength(12);
    expect(residentProblems(pack)).toEqual([]);
  });

  it('每位居民在每個時段都有預設位置（沒有天氣條件的行程）', () => {
    for (const npc of pack.npcs) {
      for (const period of PERIODS) {
        expect(spotOf(pack.schedule, npc.id, period, 'sunny'), `${npc.id} ${period}`).not.toBeNull();
      }
    }
  });

  it('行程的每一格都是存在的地圖上可以站的格子（地圖、地形都必須存在）', () => {
    const maps = new Map(pack.maps.map((m) => [m.id, m]));
    for (const entry of pack.schedule.entries) {
      const map = maps.get(entry.mapId);
      expect(map, `地圖 ${entry.mapId}`).toBeDefined();
      const tile = map ? tileAt(map, entry.x, entry.y) : null;
      expect(tile && isWalkable(tile.kind) && tile.kind !== 'door', `${entry.npcId} 在 ${entry.mapId} (${entry.x},${entry.y})`).toBe(true);
    }
  });

  it('行程的天氣條件都是有效的天氣', () => {
    for (const entry of pack.schedule.entries) {
      for (const w of entry.weather ?? []) expect(WEATHERS).toContain(w);
    }
  });

  it('同一個時段與天氣下，同一張地圖上不會有兩位居民站在同一格', () => {
    for (const period of PERIODS) {
      for (const w of WEATHERS) {
        const seen = new Set<string>();
        for (const npc of pack.npcs) {
          const spot = spotOf(pack.schedule, npc.id, period, w);
          if (!spot) continue;
          const key = `${spot.mapId}:${spot.x},${spot.y}`;
          expect(seen.has(key), `${period} ${w} ${key}`).toBe(false);
          seen.add(key);
        }
      }
    }
  });

  it('每位居民春夏各有一個心形事件：2 顆心在春、4 顆心在夏', () => {
    for (const npc of pack.npcs) {
      const mine = pack.heartEvents.filter((e) => e.npcId === npc.id).sort((a, b) => a.hearts - b.hearts);
      expect(mine.map((e) => [e.hearts, e.phase]), npc.id).toEqual([
        [2, 'spring'],
        [4, 'summer'],
      ]);
    }
  });

  it('心形事件的地點與時段，居民在那裡找得到（至少有一種天氣下在那張地圖）', () => {
    for (const event of pack.heartEvents) {
      const found = WEATHERS.some((w) => spotOf(pack.schedule, event.npcId, event.periods[0] ?? 'morning', w)?.mapId === event.mapId);
      expect(found, event.id).toBe(true);
    }
  });

  it('心形事件的文字與選項符合格式：2–3 頁、1–2 個選項、好感變化在 ±100 點以內', () => {
    for (const event of pack.heartEvents) {
      expect(event.pages.length, event.id).toBeGreaterThanOrEqual(2);
      expect(event.pages.length, event.id).toBeLessThanOrEqual(3);
      expect(event.options.length, event.id).toBeGreaterThanOrEqual(1);
      expect(event.options.length, event.id).toBeLessThanOrEqual(2);
      for (const option of event.options) expect(Math.abs(option.points), `${event.id} ${option.id}`).toBeLessThanOrEqual(100);
    }
  });

  it('喜歡與討厭的物品都是存在的物品', () => {
    const known = new Set([
      ...pack.items.map((i) => i.id),
      ...pack.crops.flatMap((c) => [`seed.${c.id}`, `crop.${c.id}`]),
      ...pack.fish.map((f) => `fish.${f.id}`),
    ]);
    for (const npc of pack.npcs) {
      for (const id of [...npc.loves, ...npc.hates]) expect(known.has(id), `${npc.id} 的偏好 ${id}`).toBe(true);
    }
  });

  it('每位居民與每個心形事件都有 2–3 分鐘的時數估計（playMinutes）', () => {
    for (const npc of pack.npcs) expect(npc.playMinutes, npc.id).toBeGreaterThanOrEqual(2);
    for (const event of pack.heartEvents) {
      expect(event.playMinutes, event.id).toBeGreaterThanOrEqual(2);
      expect(event.playMinutes, event.id).toBeLessThanOrEqual(3);
    }
  });

  it('記錄 M5a 的春夏內容時數現況（M5d 才會驗收到 120 分鐘）', () => {
    const springSummerEvents = pack.heartEvents.filter((e) => e.phase === 'spring' || e.phase === 'summer');
    const minutes = springSummerEvents.reduce((sum, e) => sum + e.playMinutes, 0) + pack.npcs.reduce((sum, n) => sum + n.playMinutes, 0);
    console.info(`[時數] M5a 春夏居民與心形事件合計 ${minutes} 分鐘（M5 之前為 0）`);
    expect(minutes).toBeGreaterThan(0);
  });
});

describe('委託與信件（M5b，真實內容）', () => {
  const quests = pack.quests;
  const defs = quests?.defs ?? [];
  const residentQuests = defs.filter((q) => q.kind === 'resident');

  it('居民委託共 25 件，每位居民 3–5 件；春夏的時數估計合計 37.5 分鐘（報告用）', () => {
    expect(residentQuests).toHaveLength(25);
    for (const npc of pack.npcs) {
      const count = residentQuests.filter((q) => q.giver === npc.id).length;
      expect(count, npc.id).toBeGreaterThanOrEqual(3);
      expect(count, npc.id).toBeLessThanOrEqual(5);
    }
    expect(residentQuests.every((q) => q.phase === 'spring' || q.phase === 'summer')).toBe(true);
    expect(residentQuests.reduce((sum, q) => sum + q.playMinutes, 0)).toBeCloseTo(37.5);
  });

  it('居民委託的目標類型涵蓋交付、收成 N 種、出貨、好感、拜訪、釣魚、挖到某層與烹飪', () => {
    expect([...new Set(residentQuests.map((q) => q.goal.type))].sort()).toEqual(
      ['cook', 'deliver', 'fish', 'harvestKinds', 'hearts', 'mineLayer', 'ship', 'visit'],
    );
  });

  it('委託的名稱互不相同（原創性與可辨識度）', () => {
    const titles = defs.map((q) => q.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('佈告欄每天抽 2 件（候選 8 件）、每週 1 件大委託（候選 3 件）', () => {
    expect(quests?.bulletin.dailyCount).toBe(2);
    expect(quests?.bulletin.daily).toHaveLength(8);
    expect(quests?.bulletin.weekly).toHaveLength(3);
  });

  it('春夏每一天的佈告欄都抽得出 2 件不重複的每日委託與 1 件大委託', () => {
    const rules = quests?.bulletin;
    if (!rules) throw new Error('缺少佈告欄規則');
    for (const season of ['spring', 'summer'] as const) {
      for (let day = 1; day <= 20; day += 1) {
        const board = drawBoard(rules, { year: 1, season, day, minuteOfDay: 360 }, 20);
        expect(board.daily).toHaveLength(2);
        expect(new Set(board.daily).size).toBe(2);
        expect(board.weekly).not.toBeNull();
      }
    }
  });

  it('信件共 12 封，寄件人都是居民，寄出日期都在春或夏之內', () => {
    const letters = pack.letters ?? [];
    expect(letters).toHaveLength(12);
    for (const letter of letters) {
      expect(letter.phase === 'spring' || letter.phase === 'summer').toBe(true);
      expect(pack.npcs.some((n) => n.id === letter.from), letter.id).toBe(true);
      if (letter.due) expect(letter.due.day, letter.id).toBeLessThanOrEqual(20);
    }
  });

  it('委託的交叉參照：真實內容沒有問題，改壞一個委託人或物品就會被找出來', () => {
    expect(questProblems(pack)).toEqual([]);
    const [first, ...rest] = defs;
    if (!quests || !first) throw new Error('缺少委託');
    const badGiver = { ...pack, quests: { ...quests, defs: [{ ...first, giver: 'nobody' }, ...rest] } };
    expect(questProblems(badGiver).some((p) => p.includes('nobody'))).toBe(true);
    const badItem = { ...pack, quests: { ...quests, defs: [{ ...first, reward: { ...first.reward, items: { 'no-such-item': 1 } } }, ...rest] } };
    expect(questProblems(badItem).some((p) => p.includes('no-such-item'))).toBe(true);
  });

  it('鎮廣場有佈告欄、小屋有信箱（地圖上的標記）', () => {
    const notices = (map: { legend: Record<string, { notice?: string }> }) => Object.values(map.legend).map((t) => t.notice).filter(Boolean);
    expect(notices(pack.maps.find((m) => m.id === 'plaza')!)).toEqual(['bulletin']);
    expect(notices(pack.maps.find((m) => m.id === 'house')!)).toEqual(['mailbox']);
  });
});

describe('居民交叉參照的問題（residentProblems）', () => {
  const schedule: ScheduleDef = {
    periods: { noon: 720, evening: 1020 },
    entries: [
      ...pack.schedule.entries,
    ],
  };

  it('行程指向不存在的地圖，或站在牆上，會回報問題', () => {
    const bad: ContentPack = {
      ...pack,
      schedule: {
        ...schedule,
        entries: [...schedule.entries, { npcId: 'maomao', period: 'evening', mapId: 'nowhere', x: 1, y: 1 }],
      },
    };
    expect(residentProblems(bad).join('\n')).toContain('nowhere');

    const wall: ContentPack = {
      ...pack,
      schedule: {
        ...schedule,
        entries: [...schedule.entries, { npcId: 'maomao', period: 'evening', weather: ['snow'], mapId: 'village', x: 0, y: 0 }],
      },
    };
    expect(residentProblems(wall).join('\n')).toContain('不可行走');
  });

  it('兩位居民站在同一格，會回報問題', () => {
    const clash: ContentPack = {
      ...pack,
      schedule: {
        ...schedule,
        entries: schedule.entries.map((e) => (e.npcId === 'a-gan' && e.period === 'morning' ? { ...e, x: 10, y: 5 } : e)),
      },
    };
    expect(residentProblems(clash).join('\n')).toContain('同一格');
  });

  it('心形事件所在的地點，居民在那個時段不會去，會回報問題', () => {
    const lost: ContentPack = {
      ...pack,
      heartEvents: pack.heartEvents.map((e) => (e.id === 'maomao-heart-1' ? { ...e, mapId: 'plaza', periods: ['morning'] } : e)),
    };
    expect(residentProblems(lost).join('\n')).toContain('maomao-heart-1');
  });

  it('心形事件的選項不存在或喜歡的物品不存在，會回報問題', () => {
    const badGift: ContentPack = {
      ...pack,
      npcs: pack.npcs.map((n) => (n.id === 'a-gan' ? { ...n, loves: ['ghost-item'] } : n)),
    };
    expect(residentProblems(badGift).join('\n')).toContain('ghost-item');
  });
});
