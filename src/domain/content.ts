/** 內容的純型別定義。資料實體放在 content/*.json，由基礎設施層載入並驗證。 */

import type { Season } from './calendar';
import type { WeatherTable } from './weather';
import type { ItemDef } from './items';
import type { ToolId } from './tools';
import type { TalentSet } from './talents';
import type { MineRules } from './mine';
import type { AnimalDef, FlockId } from './animals';
import type { Requirement } from './unlock';

export type { AnimalDef, MilkDef } from './animals';

export interface Point {
  x: number;
  y: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface CropDef {
  id: string;
  name: string;
  seedPrice: number;
  growthDays: number;
  /** 可以在哪些季節種植；換季時不在名單內的作物會枯死。 */
  seasons: Season[];
}

export interface NpcDef {
  id: string;
  name: string;
  lines: string[];
  /** 首次對話時贈送的種子；沒有則不送。 */
  gift?: { cropId: string; count: number };
  /** 喜歡的物品 id（送禮 +好感；收成這種作物時提高品質，見 friendship.ts）。 */
  loves: string[];
  /** 討厭的物品 id（送禮 −好感）。 */
  hates: string[];
  /** 內容時數的估計（分鐘），見 docs/PLAYTIME_PLAN.md。 */
  playMinutes: number;
}

export type TileKind =
  | 'tuft'
  | 'kitchen'
  | 'workshop'
  | 'trough'
  | 'workbench'
  | 'shop'
  | 'forage'
  | 'ore'
  | 'stairs'
  | 'grass'
  | 'field'
  | 'path'
  | 'wall'
  | 'bed'
  | 'shipbox'
  | 'door'
  | 'tree'
  | 'water'
  | 'floor'
  | 'furniture'
  | 'cave'
  | 'rock'
  | 'fence';

export interface TileDef {
  kind: TileKind;
  /** 僅門會用到：通往的地圖與落點。 */
  to?: string;
  spawn?: Point;
  /** 僅門會用到：進門前要符合的條件（日期或旗標），不符合時門是鎖著的，並顯示 hint。 */
  requires?: Requirement;
  /** 僅櫃檯會用到：屬於哪一家店（見 shops.json）。 */
  shop?: string;
  /** 雞舍或牛舍的座位：動物坐在這裡。 */
  slot?: boolean;
  /** 採集點：採到的物品（省略為野薄荷）與能採的季節（省略為四季皆可）。 */
  item?: string;
  seasons?: Season[];
}

export interface MapDef {
  id: string;
  name: string;
  width: number;
  height: number;
  /** 每列一個字串，字元對應 legend。 */
  rows: string[];
  legend: Record<string, TileDef>;
  spawn: Point;
  /** 這棟建築裡住的動物（雞舍住雞，牛舍住牛）；座位數就是能養的數量。 */
  flock?: FlockId;
}

import type { Tuning } from './tuning';
import type { ScheduleDef } from './schedule';
import type { HeartEventDef } from './heart-events';
import type { FriendshipRules } from './friendship';

export type { ScheduleDef, ScheduleEntry, PeriodRules, Period } from './schedule';
export type { HeartEventDef, HeartEventOption, HeartEmote } from './heart-events';
export type { FriendshipRules } from './friendship';

/** 新遊戲的起始設定。 */
export interface StartConfig {
  mapId: string;
  gold: number;
  seeds: Record<string, number>;
}

export interface ContentPack {
  crops: CropDef[];
  npcs: NpcDef[];
  maps: MapDef[];
  start: StartConfig;
  tuning: Tuning;
  weather: WeatherTable;
  /** 不是作物衍生的物品（木材、野薄荷、礦石）。 */
  items: ItemDef[];
  /** 魚的種類（釣到的魚會變成 fish.<id> 物品）。 */
  fish: FishDef[];
  /** 動物的種類（雞舍的雞、牛舍的牛）。 */
  animals: AnimalDef[];
  /** 食譜（廚房做菜，吃了回復體力）。 */
  recipes: RecipeDef[];
  /** 合成配方（工作台）。 */
  crafting: CraftingRecipeDef[];
  /** 加工機的配方（醃漬、烘乾）。 */
  processing: ProcessingDef[];
  shops: ShopDef[];
  /** 技能天賦（見 talents.ts 與 content/talents.json）。 */
  talents: TalentSet;
  /** 礦坑的深層規則（第 41 層起，見 mine.ts 與 content/mine.json）。 */
  mine: MineRules;
  /** 居民行程（依時段與天氣的位置，見 schedule.ts 與 content/schedules.json）。 */
  schedule: ScheduleDef;
  /** 心形事件（見 heart-events.ts 與 content/events.json）。 */
  heartEvents: HeartEventDef[];
  /** 好感規則（點數、上限、送禮與作物品質，見 friendship.ts 與 content/friendship.json）。 */
  friendship: FriendshipRules;
}

export interface RecipeDef {
  id: string;
  name: string;
  /** 物品 id → 數量。 */
  ingredients: Record<string, number>;
  /** 吃下去回復的體力。 */
  energy: number;
  /** 需要的烹飪等級。 */
  level: number;
  sellPrice: number;
}

/** 加工機的配方：材料放進去，過 days 天後取回一份成品（output 是物品 id）。 */
export interface ProcessingDef {
  id: string;
  name: string;
  /** 物品 id → 數量。 */
  ingredients: Record<string, number>;
  output: string;
  days: number;
  /** 需要的烹飪等級。 */
  level: number;
}

/** 合成的效果：flag 只能做一次（例如灑水器）；bagSlots 增加背包格數，最多 max 次（木箱）。 */
export type CraftEffect = { type: 'flag'; flag: string } | { type: 'bagSlots'; slots: number; max: number };

/** 合成配方（工作台）。產物與效果至少要有一個；unlock 省略表示一開始就能做。 */
export interface CraftingRecipeDef {
  id: string;
  name: string;
  /** 物品 id → 數量。 */
  ingredients: Record<string, number>;
  output?: { item: string; count: number };
  effect?: CraftEffect;
  unlock?: { skill: string; level: number };
  /** 內容時數的估計（分鐘），見 docs/PLAYTIME_PLAN.md。 */
  playMinutes: number;
}

export interface FishDef {
  id: string;
  name: string;
  sellPrice: number;
  /** 哪些季節的湖裡有這種魚。 */
  seasons: Season[];
  /** 同一季節中被釣到的相對機率（正整數）。 */
  weight: number;
}

export interface ShopStock {
  itemId: string;
  price: number;
}

/** 升級工具到某一階需要的金幣與材料（材料是 物品 id → 數量）。 */
export interface ToolUpgrade {
  toolId: ToolId;
  tier: number;
  gold: number;
  items: Record<string, number>;
}

export interface ShopDef {
  id: string;
  name: string;
  stock: ShopStock[];
  upgrades: ToolUpgrade[];
}
