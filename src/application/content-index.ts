import type { ContentPack, CraftingRecipeDef, CropDef, FishDef, MapDef, NpcDef, ProcessingDef, RecipeDef, ShopDef } from '../domain/content';
import { cropItems, type ItemDef } from '../domain/items';
import type { Tuning } from '../domain/tuning';
import { generateMineLayer, mineId, type MineRules } from '../domain/mine';
import type { AnimalDef } from '../domain/content';
import type { WeatherTable } from '../domain/weather';
import type { TalentSet } from '../domain/talents';
import type { ScheduleDef } from '../domain/schedule';
import type { HeartEventDef } from '../domain/heart-events';
import type { FriendshipRules } from '../domain/friendship';
import type { BulletinRules } from '../domain/bulletin';
import type { QuestDef } from '../domain/quests';
import type { LetterDef } from '../domain/mail';
import type { FestivalDef } from '../domain/festival';
import type { StoryChapter } from '../domain/story';
import type { RepairDef } from '../domain/repairs';
import type { DailyEventRules, RandomEventDef } from '../domain/random-events';

/**
 * 以 id 快速查找內容。假設內容已由基礎設施層驗證過參照完整性；
 * 查不到時代表程式或資料有缺陷，直接拋出錯誤，避免靜默錯誤。
 */
export interface ContentIndex {
  crop(id: string): CropDef;
  npc(id: string): NpcDef;
  map(id: string): MapDef;
  item(id: string): ItemDef;
  shop(id: string): ShopDef;
  /** 所有魚的種類（順序與內容檔相同）。 */
  fish: FishDef[];
  /** 動物的種類。 */
  animal(id: string): AnimalDef;
  /** 食譜。 */
  recipe(id: string): RecipeDef;
  /** 所有食譜（順序與內容檔相同）。 */
  recipes: RecipeDef[];
  /** 合成配方（工作台）。 */
  craftingRecipe(id: string): CraftingRecipeDef;
  /** 所有合成配方（順序與內容檔相同）。 */
  craftingRecipes: CraftingRecipeDef[];
  /** 加工機的配方。 */
  processingRecipe(id: string): ProcessingDef;
  /** 所有加工配方（順序與內容檔相同）。 */
  processingRecipes: ProcessingDef[];
  cropIds(): string[];
  /** 生成礦坑第 layer 層（同一個種子永遠一樣），之後 map(id) 就找得到它。 */
  ensureMine(layer: number, seed: number): MapDef;
  /** 礦坑的深層規則（礦石種類與產量，見 mine.json）。 */
  mine: MineRules;
  tuning: Tuning;
  weather: WeatherTable;
  /** 技能天賦：解鎖等級與所有天賦（見 talents.ts）。 */
  talents: TalentSet;
  /** 所有居民（順序與內容檔相同）。 */
  npcs: NpcDef[];
  /** 居民行程（見 schedule.ts）。 */
  schedule: ScheduleDef;
  /** 所有心形事件（順序與內容檔相同）。 */
  heartEvents: HeartEventDef[];
  heartEvent(id: string): HeartEventDef;
  /** 好感規則（見 friendship.ts）。 */
  friendship: FriendshipRules;
  /** 所有委託（順序與內容檔相同）。 */
  quests: QuestDef[];
  quest(id: string): QuestDef;
  /** 佈告欄的抽取規則（見 bulletin.ts）。 */
  bulletin: BulletinRules;
  /** 所有信件（順序與內容檔相同）。 */
  letters: LetterDef[];
  letter(id: string): LetterDef;
  /** 所有節慶（順序與內容檔相同）。 */
  festivals: FestivalDef[];
  /** 主線章節（依章節號排序）。 */
  chapters: StoryChapter[];
  /** 社區修復（順序與內容檔相同，見 repairs.ts）。 */
  repairs: RepairDef[];
  repair(id: string): RepairDef;
  /** 隨機事件的機率與候選（見 random-events.ts）。 */
  randomEvents: DailyEventRules;
  randomEvent(id: string): RandomEventDef;
}

const NO_BULLETIN: BulletinRules = { postedBy: '鎮公所', dailyCount: 0, daily: [], weekly: [] };

export function createContentIndex(pack: ContentPack): ContentIndex {
  const crops = new Map(pack.crops.map((c) => [c.id, c]));
  const npcs = new Map(pack.npcs.map((n) => [n.id, n]));
  const maps = new Map(pack.maps.map((m) => [m.id, m]));
  const fishItems = pack.fish.map((f) => ({ id: `fish.${f.id}`, name: f.name, kind: 'fish' as const, maxStack: 99, sellPrice: f.sellPrice }));
  const dishItems = pack.recipes.map((r) => ({ id: `dish.${r.id}`, name: r.name, kind: 'dish' as const, maxStack: 99, sellPrice: r.sellPrice }));
  const items = new Map([...cropItems(pack.crops), ...pack.items, ...fishItems, ...dishItems].map((i) => [i.id, i]));
  const shops = new Map(pack.shops.map((shop) => [shop.id, shop]));

  return {
    crop(id) {
      const found = crops.get(id);
      if (!found) throw new Error(`找不到作物：${id}`);
      return found;
    },
    npc(id) {
      const found = npcs.get(id);
      if (!found) throw new Error(`找不到 NPC：${id}`);
      return found;
    },
    map(id) {
      const found = maps.get(id);
      if (!found) throw new Error(`找不到地圖：${id}`);
      return found;
    },
    shop(id) {
      const found = shops.get(id);
      if (!found) throw new Error(`找不到商店：${id}`);
      return found;
    },
    item(id) {
      const found = items.get(id);
      if (!found) throw new Error(`找不到物品：${id}`);
      return found;
    },
    ensureMine(layer, seed) {
      const generated = generateMineLayer(layer, seed, pack.mine);
      maps.set(mineId(layer), generated);
      return generated;
    },
    mine: pack.mine,
    cropIds() {
      return pack.crops.map((c) => c.id);
    },
    tuning: pack.tuning,
    fish: pack.fish,
    recipes: pack.recipes,
    recipe(id) {
      const found = pack.recipes.find((r) => r.id === id);
      if (!found) throw new Error(`找不到食譜：${id}`);
      return found;
    },
    craftingRecipes: pack.crafting,
    craftingRecipe(id) {
      const found = pack.crafting.find((r) => r.id === id);
      if (!found) throw new Error(`找不到合成配方：${id}`);
      return found;
    },
    processingRecipes: pack.processing,
    processingRecipe(id) {
      const found = pack.processing.find((r) => r.id === id);
      if (!found) throw new Error(`找不到加工配方：${id}`);
      return found;
    },
    animal(id) {
      const found = pack.animals.find((a) => a.id === id);
      if (!found) throw new Error(`找不到動物：${id}`);
      return found;
    },
    weather: pack.weather,
    talents: pack.talents,
    npcs: pack.npcs,
    schedule: pack.schedule,
    heartEvents: pack.heartEvents,
    heartEvent(id) {
      const found = pack.heartEvents.find((e) => e.id === id);
      if (!found) throw new Error(`找不到心形事件：${id}`);
      return found;
    },
    friendship: pack.friendship,
    quests: pack.quests?.defs ?? [],
    quest(id) {
      const found = (pack.quests?.defs ?? []).find((q) => q.id === id);
      if (!found) throw new Error(`找不到委託：${id}`);
      return found;
    },
    bulletin: pack.quests?.bulletin ?? NO_BULLETIN,
    letters: pack.letters ?? [],
    letter(id) {
      const found = (pack.letters ?? []).find((l) => l.id === id);
      if (!found) throw new Error(`找不到信件：${id}`);
      return found;
    },
    festivals: pack.festivals ?? [],
    chapters: [...(pack.chapters ?? [])].sort((a, b) => a.number - b.number),
    repairs: pack.repairs ?? [],
    repair(id) {
      const found = (pack.repairs ?? []).find((r) => r.id === id);
      if (!found) throw new Error(`找不到修復：${id}`);
      return found;
    },
    randomEvents: pack.randomEvents ?? { chance: 0, events: [] },
    randomEvent(id) {
      const found = (pack.randomEvents?.events ?? []).find((e) => e.id === id);
      if (!found) throw new Error(`找不到隨機事件：${id}`);
      return found;
    },
  };
}
