import { SEASONS } from '../../domain/calendar';
import type { ContentPack, MapDef, Point } from '../../domain/content';
import { isWalkable, tileAt } from '../../domain/world';
import { MINE_WIDTH } from '../../domain/mine';
import { PERIODS, spotOf } from '../../domain/schedule';
import type { QuestUnlock } from '../../domain/quests';
import { WEATHERS } from '../../domain/weather';
import { assetProblems, missingAssetIds, requiredAssetIds, type AssetManifest } from '../assets/asset-manifest';
import { companionProblems, type CompanionManifest } from '../assets/companion-manifest';
import { rigProblems, type RigManifest } from '../assets/rig-manifest';
import { toolProblems, type ToolManifest } from '../assets/tool-manifest';
import {
  assetsFileSchema,
  companionsFileSchema,
  cropsFileSchema,
  mapFileSchema,
  npcsFileSchema,
  rigsFileSchema,
  itemsFileSchema,
  shopsFileSchema,
  fishFileSchema,
  animalsFileSchema,
  recipesFileSchema,
  processingFileSchema,
  craftingFileSchema,
  musicFileSchema,
  talentsFileSchema,
  mineFileSchema,
  soundsFileSchema,
  startFileSchema,
  terrainFileSchema,
  toolsFileSchema,
  tuningFileSchema,
  weatherFileSchema,
  scheduleFileSchema,
  heartEventsFileSchema,
  friendshipFileSchema,
  questsFileSchema,
  lettersFileSchema,
  festivalsFileSchema,
  mainQuestFileSchema,
  repairsFileSchema,
  randomEventsFileSchema,
  collectionFileSchema,
  achievementsFileSchema,
  merchantFileSchema,
  decorFileSchema,
  type MusicFile,
  type SoundsFile,
  type TerrainFile,
} from './content-schema';
import { festivalProblems, storyProblems } from './festival-content';
import { randomEventProblems, repairProblems } from './repairs-content';
import { achievementProblems, collectionProblems } from './collection-content';
import { housePathProblems, merchantProblems } from './merchant-content';
import { legacyProblems, ratingProblems } from './legacy-content';
import { legacyFileSchema, ratingFileSchema } from './content-schema';
import type { StoryChapter } from '../../domain/story';

export interface RawContentFiles {
  /** 農場評級（content/rating.json）。測試用的最小內容可以省略（視為單一等級、不計分）。 */
  rating?: unknown;
  /** 豐收重置與傳承（content/legacy.json）。測試用的最小內容可以省略（視為沒有豐收重置與傳承）。 */
  legacy?: unknown;
  /** 節慶（content/festivals.json）。測試用的最小內容可以省略（視為沒有節慶）。 */
  festivals?: unknown;
  /** 主線章節（content/main-quest.json）。測試用的最小內容可以省略（視為沒有章節）。 */
  mainQuest?: unknown;
  /** 社區修復（content/repairs.json）。測試用的最小內容可以省略（視為沒有修復）。 */
  repairs?: unknown;
  /** 隨機事件（content/events-random.json）。測試用的最小內容可以省略（視為沒有隨機事件）。 */
  randomEvents?: unknown;
  /** 圖鑑類別（content/collection.json）。測試用的最小內容可以省略（視為沒有圖鑑）。 */
  collection?: unknown;
  /** 成就（content/achievements.json）。測試用的最小內容可以省略（視為沒有成就）。 */
  achievements?: unknown;
  /** 旅行商人（content/traveling-merchant.json）。測試用的最小內容可以省略（視為沒有旅行商人）。 */
  merchant?: unknown;
  /** 裝飾與服飾的時數（content/decor.json）。測試用的最小內容可以省略。 */
  decor?: unknown;
  crops: unknown;
  npcs: unknown;
  /** 居民行程（content/schedules.json）。 */
  schedules: unknown;
  /** 心形事件（content/events.json）。 */
  events: unknown;
  /** 好感規則（content/friendship.json）。 */
  friendship: unknown;
  /** 委託與佈告欄（content/quests.json）。 */
  quests: unknown;
  /** 信件（content/letters.json）。 */
  letters: unknown;
  maps: unknown[];
  start: unknown;
  tuning: unknown;
  assets: unknown;
  rigs: unknown;
  companions: unknown;
  tools: unknown;
  sounds: unknown;
  music: unknown;
  terrain: unknown;
  weather: unknown;
  items: unknown;
  shops: unknown;
  fish: unknown;
  animals: unknown;
  recipes: unknown;
  processing: unknown;
  crafting: unknown;
  talents: unknown;
  mine: unknown;
}

export interface LoadedContent {
  pack: ContentPack;
  assets: AssetManifest;
  rigs: RigManifest;
  companions: CompanionManifest;
  tools: ToolManifest;
  sounds: SoundsFile;
  music: MusicFile;
  terrain: TerrainFile;
}

/** 內容錯誤會一次列出所有問題，方便一次修正。 */
export class ContentError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`內容資料有 ${problems.length} 個問題：\n- ${problems.join('\n- ')}`);
    this.name = 'ContentError';
    this.problems = problems;
  }
}

export function loadContent(raw: RawContentFiles): LoadedContent {
  const crops = cropsFileSchema.parse(raw.crops);
  const npcs = npcsFileSchema.parse(raw.npcs);
  const maps = raw.maps.map((m) => mapFileSchema.parse(m));
  const start = startFileSchema.parse(raw.start);
  const tuning = tuningFileSchema.parse(raw.tuning);
  const assets: AssetManifest = assetsFileSchema.parse(raw.assets);
  const rigs: RigManifest = rigsFileSchema.parse(raw.rigs);
  const companions: CompanionManifest = companionsFileSchema.parse(raw.companions);
  const tools: ToolManifest = toolsFileSchema.parse(raw.tools);
  const sounds = soundsFileSchema.parse(raw.sounds);
  const music = musicFileSchema.parse(raw.music);
  const terrain = terrainFileSchema.parse(raw.terrain);
  const weather = weatherFileSchema.parse(raw.weather);

  const items = itemsFileSchema.parse(raw.items);
  const shops = shopsFileSchema.parse(raw.shops);
  const fish = fishFileSchema.parse(raw.fish);
  const animals = animalsFileSchema.parse(raw.animals);
  const recipes = recipesFileSchema.parse(raw.recipes);
  const processing = processingFileSchema.parse(raw.processing);
  const crafting = craftingFileSchema.parse(raw.crafting);
  const talents = talentsFileSchema.parse(raw.talents);
  const mine = mineFileSchema.parse(raw.mine);
  const schedule = scheduleFileSchema.parse(raw.schedules);
  const heartEvents = heartEventsFileSchema.parse(raw.events);
  const friendship = friendshipFileSchema.parse(raw.friendship);
  const quests = questsFileSchema.parse(raw.quests);
  const letters = lettersFileSchema.parse(raw.letters);
  const festivals = festivalsFileSchema.parse(raw.festivals ?? { version: 1, festivals: [] });
  const mainQuest = mainQuestFileSchema.parse(raw.mainQuest ?? { version: 1, chapters: [] });
  const repairs = repairsFileSchema.parse(raw.repairs ?? { version: 1, repairs: [] });
  const randomEvents = randomEventsFileSchema.parse(raw.randomEvents ?? { version: 1, chance: 0, events: [] });
  const collection = collectionFileSchema.parse(raw.collection ?? { version: 1, categories: [] });
  const achievements = achievementsFileSchema.parse(raw.achievements ?? { version: 1, achievements: [] });
  const merchant = raw.merchant === undefined ? undefined : merchantFileSchema.parse(raw.merchant);
  const decor = raw.decor === undefined ? undefined : decorFileSchema.parse(raw.decor);
  const rating = raw.rating === undefined ? undefined : ratingFileSchema.parse(raw.rating);
  const legacy = raw.legacy === undefined ? undefined : legacyFileSchema.parse(raw.legacy);

  const pack: ContentPack = {
    crops,
    npcs,
    maps,
    start,
    tuning,
    weather: weather.seasons,
    items: items.items,
    shops: shops.shops,
    fish: fish.fish,
    animals: animals.animals,
    recipes: recipes.recipes,
    processing: processing.recipes,
    crafting: crafting.recipes,
    talents: { unlockLevel: talents.unlockLevel, defs: talents.talents },
    mine: { widthPerLayer: mine.widthPerLayer, maxWidth: mine.maxWidth, oreChance: mine.oreChance, ores: mine.ores },
    schedule: { periods: schedule.periods, entries: schedule.entries },
    heartEvents: heartEvents.events,
    friendship,
    quests: { defs: quests.quests, bulletin: quests.bulletin },
    letters: letters.letters,
    festivals: festivals.festivals,
    // 步驟的「恰好一個旗標或委託」已由 schema 檢查；型別上 zod 的輸出較寬，這裡收窄回 StoryStep。
    chapters: mainQuest.chapters as StoryChapter[],
    repairs: repairs.repairs,
    randomEvents: { chance: randomEvents.chance, events: randomEvents.events },
    collection: collection.categories,
    achievements: achievements.achievements,
    merchant: merchant && {
      weekdays: merchant.weekdays,
      slots: merchant.slots,
      perItemWeekly: merchant.perItemWeekly,
      playMinutes: merchant.playMinutes,
      candidates: merchant.candidates,
    },
    decor: decor && { placeMinutes: decor.placeMinutes, wearMinutes: decor.wearMinutes },
    rating,
    legacy,
  };
  const problems = [
    ...validateCrossReferences(pack, assets),
    ...residentProblems(pack),
    ...questProblems(pack),
    ...festivalProblems(pack),
    ...storyProblems(pack),
    ...repairProblems(pack),
    ...randomEventProblems(pack),
    ...collectionProblems(pack),
    ...achievementProblems(pack),
    ...merchantProblems(pack),
    ...housePathProblems(pack),
    ...rigProblems(rigs, assets),
    ...companionProblems(companions, rigs, pack),
    ...toolProblems(tools, assets),
    ...terrainProblems(terrain, sounds, maps),
    ...musicProblems(music),
    ...economyProblems(pack),
    ...talentProblems(pack),
    ...mineProblems(pack),
    ...(rating ? ratingProblems(rating) : []),
    ...legacyProblems(pack),
  ];
  if (problems.length > 0) throw new ContentError(problems);
  return { pack, assets, rigs, companions, tools, sounds, music, terrain };
}

/** 背景音樂：音階要存在、旋律與低音等長（循環才對齊），且每個季節與時段恰好一首。 */
export function musicProblems(music: MusicFile): string[] {
  const problems: string[] = [];
  duplicates(music.tracks.map((t) => t.id), 'music track', problems);
  for (const track of music.tracks) {
    if (!(track.scale in music.scales)) problems.push(`曲目 ${track.id} 的音階 ${track.scale} 不存在`);
    const melodyBeats = track.melody.notes.reduce((sum, [, beats]) => sum + beats, 0);
    const bassBeats = track.bass.notes.reduce((sum, [, beats]) => sum + beats, 0);
    if (melodyBeats !== bassBeats) {
      problems.push(`曲目 ${track.id} 的旋律與低音拍數不同（${melodyBeats} 與 ${bassBeats}）`);
    }
  }
  for (const season of SEASONS) {
    for (const period of ['day', 'night'] as const) {
      const count = music.tracks.filter((t) => t.season === season && t.period === period).length;
      if (count === 0) problems.push(`缺少 ${season} ${period} 的曲目`);
      if (count > 1) problems.push(`${season} ${period} 有 ${count} 首曲目，每個季節與時段只能有一首`);
    }
  }
  return problems;
}

/** 每種可走的地形都要有腳步設定，且腳步指向存在的音效。 */
export function terrainProblems(terrain: TerrainFile, sounds: SoundsFile, maps: MapDef[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const entry of terrain.terrains) {
    if (seen.has(entry.kind)) problems.push(`地形 ${entry.kind} 重複定義`);
    seen.add(entry.kind);
    if (!(entry.footstep.sound in sounds.sounds)) {
      problems.push(`地形 ${entry.kind} 的腳步音效 ${entry.footstep.sound} 不存在`);
    }
  }
  const walkedKinds = new Set<string>();
  for (const map of maps) {
    for (const tile of Object.values(map.legend)) {
      if (isWalkable(tile.kind) && tile.kind !== 'door') walkedKinds.add(tile.kind);
    }
  }
  for (const kind of walkedKinds) {
    if (!seen.has(kind)) problems.push(`地圖上的地形 ${kind} 沒有腳步設定（content/terrain.json）`);
  }
  return problems;
}

export function validateCrossReferences(pack: ContentPack, assets: AssetManifest): string[] {
  const problems: string[] = [];
  const cropIds = new Set(pack.crops.map((c) => c.id));
  const mapById = new Map(pack.maps.map((m) => [m.id, m]));

  duplicates(pack.crops.map((c) => c.id), 'crop', problems);
  duplicates(pack.npcs.map((n) => n.id), 'npc', problems);
  duplicates(pack.maps.map((m) => m.id), 'map', problems);

  for (const npc of pack.npcs) {
    if (npc.gift && !cropIds.has(npc.gift.cropId)) {
      problems.push(`NPC ${npc.id} 的贈禮作物 ${npc.gift.cropId} 不存在`);
    }
  }

  for (const map of pack.maps) {
    validateMapShape(map, problems);
    for (const [symbol, tile] of Object.entries(map.legend)) {
      if (tile.kind === 'door') {
        if (!tile.to || !mapById.has(tile.to)) {
          problems.push(`地圖 ${map.id} 的門 ${symbol} 指向不存在的地圖 ${tile.to ?? '(未填)'}`);
          continue;
        }
        const target = mapById.get(tile.to);
        if (!target) continue;
        const landing = tile.spawn ?? target.spawn;
        if (!isWalkableAt(target, landing)) {
          problems.push(`地圖 ${map.id} 的門 ${symbol} 落點 (${landing.x},${landing.y}) 在 ${target.id} 不可行走`);
        }
      }
    }
  }

  const start = mapById.get(pack.start.mapId);
  if (!start) {
    problems.push(`起始地圖 ${pack.start.mapId} 不存在`);
  } else if (!isWalkableAt(start, start.spawn)) {
    problems.push(`起始地圖 ${start.id} 的出生點不可行走`);
  }
  for (const cropId of Object.keys(pack.start.seeds)) {
    if (!cropIds.has(cropId)) problems.push(`起始種子 ${cropId} 不存在`);
  }

  const tileKinds = new Set<string>();
  for (const map of pack.maps) for (const tile of Object.values(map.legend)) tileKinds.add(tile.kind);
  const required = requiredAssetIds(
    [...tileKinds],
    pack.crops.map((c) => c.id),
    pack.npcs.map((n) => n.id),
  );
  for (const id of missingAssetIds(assets, required)) {
    problems.push(`素材清單缺少 ${id}`);
  }
  problems.push(...assetProblems(assets));

  return problems;
}

/**
 * 居民的交叉參照：行程的居民與地圖要存在、站的格子要能走；每個時段都有預設位置；
 * 同一個時段與天氣下，同一張地圖上不能有兩位居民站在同一格；心形事件的居民要在事件的地點與時段找得到；
 * 居民的偏好物品要存在。
 */
export function residentProblems(pack: ContentPack): string[] {
  const problems: string[] = [];
  const npcIds = new Set(pack.npcs.map((n) => n.id));
  const maps = new Map(pack.maps.map((m) => [m.id, m]));
  const itemIds = new Set([
    ...pack.items.map((i) => i.id),
    ...pack.crops.flatMap((c) => [`seed.${c.id}`, `crop.${c.id}`]),
    ...pack.fish.map((f) => `fish.${f.id}`),
  ]);
  const schedule = pack.schedule;

  duplicates(pack.npcs.map((n) => n.id), 'npc', problems);
  duplicates(pack.heartEvents.map((e) => e.id), 'heart event', problems);

  for (const npc of pack.npcs) {
    for (const id of [...npc.loves, ...npc.hates]) {
      if (!itemIds.has(id)) problems.push(`居民 ${npc.id} 的偏好物品 ${id} 不存在`);
    }
    for (const period of PERIODS) {
      if (!spotOf(schedule, npc.id, period, 'sunny')) problems.push(`居民 ${npc.id} 在${PERIOD_LABEL[period]}沒有預設行程`);
    }
  }

  for (const entry of schedule.entries) {
    if (!npcIds.has(entry.npcId)) problems.push(`行程的居民 ${entry.npcId} 不存在`);
    const map = maps.get(entry.mapId);
    if (!map) {
      problems.push(`居民 ${entry.npcId} 的行程指向不存在的地圖 ${entry.mapId}`);
      continue;
    }
    if (!isWalkableAt(map, entry)) problems.push(`居民 ${entry.npcId} 的行程 ${entry.mapId} (${entry.x},${entry.y}) 不可行走`);
  }

  for (const period of PERIODS) {
    for (const weather of WEATHERS) {
      const taken = new Map<string, string>();
      for (const npc of pack.npcs) {
        const spot = spotOf(schedule, npc.id, period, weather);
        if (!spot) continue;
        const key = `${spot.mapId}:${spot.x},${spot.y}`;
        const other = taken.get(key);
        if (other) problems.push(`${PERIOD_LABEL[period]}（${weather}）時，${other} 與 ${npc.id} 站在同一格 ${key}`);
        else taken.set(key, npc.id);
      }
    }
  }

  for (const event of pack.heartEvents) {
    if (!npcIds.has(event.npcId)) problems.push(`心形事件 ${event.id} 的居民 ${event.npcId} 不存在`);
    if (!maps.has(event.mapId)) problems.push(`心形事件 ${event.id} 的地點 ${event.mapId} 不存在`);
    for (const period of event.periods) {
      const found = WEATHERS.some((w) => spotOf(schedule, event.npcId, period, w)?.mapId === event.mapId);
      if (!found) problems.push(`心形事件 ${event.id}：${event.npcId} 在${PERIOD_LABEL[period]}不會到 ${event.mapId}`);
    }
  }
  return problems;
}

const PERIOD_LABEL = { morning: '早上', noon: '中午', evening: '傍晚' } as const;

/**
 * 委託與信件的交叉參照：委託人、物品、作物、魚、食譜、地點、心形事件、信件與旗標都要存在；
 * 居民委託的好感目標要在春夏的好感上限以內（否則春夏做不完）；佈告欄的候選與委託種類要一致。
 */
export function questProblems(pack: ContentPack): string[] {
  const problems: string[] = [];
  const quests = pack.quests;
  const letters = pack.letters ?? [];
  if (!quests) return problems;
  const npcs = new Map(pack.npcs.map((n) => [n.id, n]));
  const maps = new Set(pack.maps.map((m) => m.id));
  const fishIds = new Set(pack.fish.map((f) => f.id));
  const recipeIds = new Set(pack.recipes.map((r) => r.id));
  const heartEventIds = new Set(pack.heartEvents.map((e) => e.id));
  const letterIds = new Set(letters.map((l) => l.id));
  const itemIds = new Set([
    ...pack.items.map((i) => i.id),
    ...pack.crops.flatMap((c) => [`seed.${c.id}`, `crop.${c.id}`]),
    ...pack.fish.map((f) => `fish.${f.id}`),
    ...pack.recipes.map((r) => `dish.${r.id}`),
    ...pack.animals.map((a) => `animal.${a.id}`),
  ]);
  // 旗標的來源：合成的效果、店家的改建，以及委託的獎勵；解鎖條件用到的旗標都要有來源。
  const knownFlags = new Set<string>([
    ...pack.crafting.flatMap((r) => (r.effect?.type === 'flag' ? [r.effect.flag] : [])),
    ...pack.shops.flatMap((s) => s.stock.filter((line) => line.itemId.startsWith('building.')).map((line) => line.itemId.slice('building.'.length))),
    ...quests.defs.flatMap((q) => (q.reward.flag ? [q.reward.flag] : [])),
  ]);
  const earlyHearts = pack.friendship.earlyCap.hearts;

  duplicates(quests.defs.map((q) => q.id), 'quest', problems);
  duplicates(letters.map((l) => l.id), 'letter', problems);

  const checkUnlock = (owner: string, unlock: QuestUnlock): void => {
    if (unlock.hearts && !npcs.has(unlock.hearts.npcId)) problems.push(`${owner} 的好感條件居民 ${unlock.hearts.npcId} 不存在`);
    if (unlock.heartEvent !== undefined && !heartEventIds.has(unlock.heartEvent)) problems.push(`${owner} 的條件心形事件 ${unlock.heartEvent} 不存在`);
    if (unlock.letter !== undefined && !letterIds.has(unlock.letter)) problems.push(`${owner} 的條件信件 ${unlock.letter} 不存在`);
    if (unlock.flag !== undefined && !knownFlags.has(unlock.flag)) problems.push(`${owner} 的條件旗標 ${unlock.flag} 沒有任何來源`);
  };

  for (const quest of quests.defs) {
    const owner = `委託 ${quest.id}`;
    if (quest.kind === 'resident') {
      if (!quest.giver || !npcs.has(quest.giver)) problems.push(`${owner} 的委託人 ${quest.giver ?? '(未填)'} 不存在`);
    } else {
      if (quest.giver !== undefined) problems.push(`${owner} 是佈告欄的委託，不應指定委託人`);
      if (quest.reward.friendship !== undefined) problems.push(`${owner} 是佈告欄的委託，沒有委託人可以加好感`);
    }
    for (const itemId of Object.keys(quest.reward.items ?? {})) {
      if (!itemIds.has(itemId)) problems.push(`${owner} 的獎勵物品 ${itemId} 不存在`);
    }
    const goal = quest.goal;
    switch (goal.type) {
      case 'deliver':
        if (!itemIds.has(goal.itemId)) problems.push(`${owner} 要交付的物品 ${goal.itemId} 不存在`);
        break;
      case 'hearts':
        if (!npcs.has(goal.npcId)) problems.push(`${owner} 的好感目標居民 ${goal.npcId} 不存在`);
        if ((quest.phase === 'spring' || quest.phase === 'summer') && goal.hearts > earlyHearts) {
          problems.push(`${owner} 的好感目標 ${goal.hearts} 顆心超過春夏的上限 ${earlyHearts} 顆`);
        }
        break;
      case 'visit':
        if (!maps.has(goal.mapId)) problems.push(`${owner} 要拜訪的地點 ${goal.mapId} 不存在`);
        break;
      case 'fish':
        if (!fishIds.has(goal.fishId)) problems.push(`${owner} 要釣的魚 ${goal.fishId} 不存在`);
        break;
      case 'cook':
        if (!recipeIds.has(goal.recipeId)) problems.push(`${owner} 要烹飪的食譜 ${goal.recipeId} 不存在`);
        break;
      case 'harvestKinds':
      case 'ship':
      case 'mineLayer':
        break;
    }
    if (quest.unlock) checkUnlock(owner, quest.unlock);
  }

  const bulletin = quests.bulletin;
  for (const id of bulletin.daily) {
    const def = quests.defs.find((q) => q.id === id);
    if (!def || def.kind !== 'daily') problems.push(`佈告欄的每日候選 ${id} 不存在或不是每日委託`);
  }
  for (const id of bulletin.weekly) {
    const def = quests.defs.find((q) => q.id === id);
    if (!def || def.kind !== 'weekly') problems.push(`佈告欄的大委託候選 ${id} 不存在或不是大委託`);
  }
  if (bulletin.daily.length < bulletin.dailyCount) problems.push(`佈告欄每天要抽 ${bulletin.dailyCount} 件，但候選只有 ${bulletin.daily.length} 件`);
  for (const def of quests.defs) {
    if (def.kind === 'daily' && !bulletin.daily.includes(def.id)) problems.push(`每日委託 ${def.id} 不在佈告欄的候選清單裡`);
    if (def.kind === 'weekly' && !bulletin.weekly.includes(def.id)) problems.push(`大委託 ${def.id} 不在佈告欄的候選清單裡`);
  }

  for (const letter of letters) {
    if (!npcs.has(letter.from)) problems.push(`信件 ${letter.id} 的寄件人 ${letter.from} 不存在`);
    if (letter.unlock) checkUnlock(`信件 ${letter.id}`, letter.unlock);
  }
  return problems;
}

function validateMapShape(map: MapDef, problems: string[]): void {
  if (map.rows.length !== map.height) {
    problems.push(`地圖 ${map.id} 的列數 ${map.rows.length} 與 height ${map.height} 不符`);
  }
  map.rows.forEach((row, y) => {
    if (row.length !== map.width) {
      problems.push(`地圖 ${map.id} 第 ${y} 列長度 ${row.length} 與 width ${map.width} 不符`);
    }
    for (const symbol of row) {
      if (!map.legend[symbol]) problems.push(`地圖 ${map.id} 使用了未定義的符號 "${symbol}"`);
    }
  });
  if (!isWalkableAt(map, map.spawn)) {
    problems.push(`地圖 ${map.id} 的出生點 (${map.spawn.x},${map.spawn.y}) 不可行走`);
  }
}

function isWalkableAt(map: MapDef, point: Point): boolean {
  const tile = tileAt(map, point.x, point.y);
  return tile !== null && isWalkable(tile.kind) && tile.kind !== 'door';
}

function duplicates(ids: string[], label: string, problems: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) problems.push(`${label} id 重複：${id}`);
    seen.add(id);
  }
}

/** 天賦的交叉檢查：id 不重複、指定的物品要存在。技能 id 已由 schema 的列舉檢查。 */
export function talentProblems(pack: ContentPack): string[] {
  const problems: string[] = [];
  duplicates(pack.talents.defs.map((t) => t.id), 'talent', problems);
  const itemIds = new Set(pack.items.map((i) => i.id));
  for (const talent of pack.talents.defs) {
    const effect = talent.effect;
    if (effect.type === 'extraYield' && effect.item !== undefined && !itemIds.has(effect.item)) {
      problems.push(`天賦 ${talent.id} 指定的物品 ${effect.item} 不存在`);
    }
  }
  return problems;
}

/**
 * 礦坑深層規則的檢查：礦石的物品要存在、符號不重複且不與地圖符號（# r . < >）衝突、
 * 層數範圍要合理、寬度上限不能小於第一段的寬度（第一段寬度是程式的校準值）。
 */
export function mineProblems(pack: ContentPack): string[] {
  const problems: string[] = [];
  const itemIds = new Set(pack.items.map((i) => i.id));
  const reserved = new Set(['#', 'r', '.', '<', '>']);
  const symbols = new Set<string>();
  for (const ore of pack.mine.ores) {
    if (!itemIds.has(ore.item)) problems.push(`礦石 ${ore.item} 不存在`);
    if (reserved.has(ore.symbol)) problems.push(`礦石符號 ${ore.symbol} 與地圖符號衝突（${ore.item}）`);
    if (symbols.has(ore.symbol)) problems.push(`礦石符號 ${ore.symbol} 重複（${ore.item}）`);
    symbols.add(ore.symbol);
    if (ore.toLayer !== undefined && ore.toLayer < ore.fromLayer) problems.push(`礦石 ${ore.item} 的 toLayer 小於 fromLayer`);
  }
  if (!pack.mine.ores.some((ore) => ore.fromLayer === 1)) problems.push('礦坑第 1 層沒有任何礦石');
  if (pack.mine.maxWidth < MINE_WIDTH) problems.push('礦坑寬度上限不可小於第一段的寬度');
  return problems;
}

/** 商店與物品的交叉檢查：櫃檯指向的店要存在、賣的東西與升級的材料要存在、升級的階級要在範圍內。 */
export function economyProblems(pack: ContentPack): string[] {
  const problems: string[] = [];
  const itemIds = new Set([
    ...pack.items.map((i) => i.id),
    ...pack.crops.flatMap((c) => [`seed.${c.id}`, `crop.${c.id}`]),
    ...pack.fish.map((f) => `fish.${f.id}`),
    ...pack.animals.map((a) => `animal.${a.id}`),
  ]);
  for (const animal of pack.animals) {
    if (animal.eggItem !== undefined && !pack.items.some((i) => i.id === animal.eggItem)) {
      problems.push(`動物 ${animal.id} 下的蛋 ${animal.eggItem} 不存在`);
    }
    if (animal.milk !== undefined && !pack.items.some((i) => i.id === animal.milk?.item)) {
      problems.push(`動物 ${animal.id} 產的奶 ${animal.milk.item} 不存在`);
    }
  }
  for (const map of pack.maps) {
    if (map.flock !== undefined && !Object.values(map.legend).some((tile) => tile.slot)) {
      problems.push(`地圖 ${map.id} 住著 ${map.flock}，卻沒有座位（slot）`);
    }
  }
  const shopIds = new Set(pack.shops.map((s) => s.id));
  for (const recipe of pack.crafting) {
    for (const itemId of Object.keys(recipe.ingredients)) {
      if (!itemIds.has(itemId)) problems.push(`合成配方 ${recipe.id} 的材料 ${itemId} 不存在`);
    }
    if (recipe.output && !itemIds.has(recipe.output.item)) problems.push(`合成配方 ${recipe.id} 的產物 ${recipe.output.item} 不存在`);
  }
  for (const map of pack.maps) {
    for (const [symbol, tile] of Object.entries(map.legend)) {
      if (tile.item && !itemIds.has(tile.item)) problems.push(`地圖 ${map.id} 的採集點 ${symbol} 的物品 ${tile.item} 不存在`);
    }
  }
  for (const recipe of pack.processing) {
    for (const itemId of Object.keys(recipe.ingredients)) {
      if (!itemIds.has(itemId)) problems.push(`加工配方 ${recipe.id} 的材料 ${itemId} 不存在`);
    }
    if (!itemIds.has(recipe.output)) problems.push(`加工配方 ${recipe.id} 的成品 ${recipe.output} 不存在`);
  }
  duplicates(pack.items.map((i) => i.id), 'item', problems);
  duplicates(pack.shops.map((s) => s.id), 'shop', problems);
  for (const shop of pack.shops) {
    for (const line of shop.stock) {
      if (!itemIds.has(line.itemId)) problems.push(`商店 ${shop.id} 賣的物品 ${line.itemId} 不存在`);
    }
    for (const upgrade of shop.upgrades) {
      if (upgrade.tier >= pack.tuning.tools.tiers.length) problems.push(`商店 ${shop.id} 的升級階級 ${upgrade.tier} 超出工具階級範圍`);
      for (const itemId of Object.keys(upgrade.items)) {
        if (!itemIds.has(itemId)) problems.push(`商店 ${shop.id} 的升級材料 ${itemId} 不存在`);
      }
    }
  }
  for (const map of pack.maps) {
    for (const tile of Object.values(map.legend)) {
      if (tile.kind === 'shop' && (!tile.shop || !shopIds.has(tile.shop))) {
        problems.push(`地圖 ${map.id} 的櫃檯指向不存在的商店 ${tile.shop ?? '(未填)'}`);
      }
    }
  }
  return problems;
}

