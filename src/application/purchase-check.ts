import { slotsOf } from '../domain/animals';
import type { ToolUpgrade } from '../domain/content';
import { expansionRefusal } from '../domain/house';
import type { GameState, ToolId } from '../domain/game-state';
import { addItem, countOf } from '../domain/inventory';
import { onSale } from '../domain/shop-stock';
import { boughtThisWeek, merchantOpen, weekStock, type MerchantLine } from '../domain/traveling-merchant';
import type { ContentIndex } from './content-index';
import { stallRefusal } from './festival';

/**
 * 購買與升級的「能不能」判斷（應用層純函式，不含站位與訊息）。
 * 回傳拒絕原因代碼（對應 game-commands.ts 的 FAILURE_MESSAGES），能買、能升級時回傳 null。
 * 站位（NOT_AT_SHOP）仍由 buy()、upgrade() 先檢查；這裡的判斷順序與原本的 buy()、upgrade() 相同。
 * 商店面板的按鈕也呼叫這裡，規則只有一份。
 */

/** 動物住的建築與改建旗標（座位數就是那棟建築的 slot 格）。 */
const COOP_ID = 'coop';
const COWBARN_ID = 'cowbarn';
const SHEEP_PEN_ID = 'pasture';
const COWBARN_FLAG = 'cowbarn';

/** 這一件（一個）在這家店的單價；找不到就是 0（呼叫端應先用 buyRefusal 確認有這一項）。 */
export function unitPriceOf(state: GameState, index: ContentIndex, shopId: string, itemId: string): number {
  const shop = index.shop(shopId);
  if (shop.rotating) return merchantStock(state, index).find((line) => line.itemId === itemId)?.price ?? 0;
  return shop.stock.find((line) => line.itemId === itemId)?.price ?? 0;
}

/** 能不能買 count 件 itemId（在 shopId 這家店）。 */
export function buyRefusal(state: GameState, index: ContentIndex, shopId: string, itemId: string, count: number): string | null {
  const shop = index.shop(shopId);
  // 旅行商人的貨架每週輪換，走自己的規則（週五、六開門、每週每件有上限）。
  if (shop.rotating) return merchantRefusal(state, index, itemId, count);
  const line = shop.stock.find((s) => s.itemId === itemId);
  if (!line) return 'NOT_SOLD';
  // 季節進貨：換季後下架的商品買不到（見 domain/shop-stock.ts）。
  if (!onSale(line, state.calendar.season)) return 'NOT_IN_STOCK_SEASON';
  // 節慶攤位：只在節慶開著時能買，有限量的物品不能超過今年的數量（見 festival.ts）。
  const closed = stallRefusal(state, index, shopId, itemId, count);
  if (closed) return closed;
  if (state.gold < line.price * count) return 'NO_GOLD';
  if (itemId.startsWith('animal.')) return animalRefusal(state, index, itemId.slice('animal.'.length), count);
  if (itemId.startsWith('building.')) return remodelRefusal(state, itemId, count);
  if (itemId.startsWith('recipe.')) return recipeRefusal(state, itemId, count);
  return bagRefusal(state, index, itemId, count);
}

/** 能不能升級 toolId 到下一階（在 shopId 這家店）。 */
export function upgradeRefusal(state: GameState, index: ContentIndex, shopId: string, toolId: ToolId): string | null {
  const next = state.toolTiers[toolId] + 1;
  if (next >= index.tuning.tools.tiers.length) return 'TIER_MAX';
  const recipe = upgradeRecipe(state, index, shopId, toolId);
  if (!recipe) return 'NOT_FOR_SALE';
  if (state.gold < recipe.gold) return 'NO_GOLD';
  if (missingMaterials(state, index, recipe.items).length > 0) return 'NO_MATERIAL';
  return null;
}

/** 這家店賣給 toolId 的下一階升級配方；沒有就是 undefined。 */
export function upgradeRecipe(state: GameState, index: ContentIndex, shopId: string, toolId: ToolId): ToolUpgrade | undefined {
  const next = state.toolTiers[toolId] + 1;
  return index.shop(shopId).upgrades.find((u) => u.toolId === toolId && u.tier === next);
}

/** 背包還缺的材料，格式為「物品名稱 × 數量」（依配方的順序）。 */
export function missingMaterials(state: GameState, index: ContentIndex, items: Record<string, number>): string[] {
  const missing: string[] = [];
  for (const [itemId, count] of Object.entries(items)) {
    const have = countOf(state.inventory, itemId);
    if (have < count) missing.push(`${index.item(itemId).name} × ${count - have}`);
  }
  return missing;
}

/** 旅行商人本週的貨架（沒有旅行商人規則時是空的）。 */
function merchantStock(state: GameState, index: ContentIndex): MerchantLine[] {
  const rules = index.merchant;
  if (!rules) return [];
  return weekStock(rules, state.calendar, index.tuning.time.daysPerSeason);
}

function merchantRefusal(state: GameState, index: ContentIndex, itemId: string, count: number): string | null {
  const rules = index.merchant;
  const daysPerSeason = index.tuning.time.daysPerSeason;
  if (!rules || !merchantOpen(rules, state.calendar, daysPerSeason)) return 'MERCHANT_AWAY';
  const line = merchantStock(state, index).find((l) => l.itemId === itemId);
  if (!line) return 'NOT_SOLD';
  const had = boughtThisWeek(state.merchant, state.calendar, daysPerSeason)[itemId] ?? 0;
  if (had + count > rules.perItemWeekly) return 'MERCHANT_LIMIT';
  if (state.gold < line.price * count) return 'NO_GOLD';
  return bagRefusal(state, index, itemId, count);
}

/** 動物：一次只買一隻；牛要牛舍已改建、有座位；羊要羊圈有座位；雞要雞舍有座位。 */
function animalRefusal(state: GameState, index: ContentIndex, kind: string, count: number): string | null {
  if (count !== 1) return 'NOT_SOLD';
  const def = index.animal(kind);
  if (def.milk) {
    if (state.flags[COWBARN_FLAG] !== true) return 'NO_BARN';
    return state.cows.length >= seatsIn(index, COWBARN_ID) ? 'NO_COW_ROOM' : null;
  }
  if (def.wool) return state.sheep.length >= seatsIn(index, SHEEP_PEN_ID) ? 'NO_SHEEP_ROOM' : null;
  return state.animals.length >= seatsIn(index, COOP_ID) ? 'NO_ROOM' : null;
}

/** 改建：只買一次，小屋擴建要先有第一次（見 domain/house.ts）。 */
function remodelRefusal(state: GameState, itemId: string, count: number): string | null {
  if (count !== 1) return 'NOT_SOLD';
  return expansionRefusal(state.flags, itemId.slice('building.'.length));
}

/** 配方：只學一次。 */
function recipeRefusal(state: GameState, itemId: string, count: number): string | null {
  if (count !== 1) return 'NOT_SOLD';
  return state.flags[`recipe:${itemId.slice('recipe.'.length)}`] ? 'ALREADY_OWNED' : null;
}

/** 一般物品：放得進背包才能買。 */
function bagRefusal(state: GameState, index: ContentIndex, itemId: string, count: number): string | null {
  return addItem(state.inventory, index.item(itemId), count).ok ? null : 'BAG_FULL';
}

/** 建築的座位數就是那棟建築能養的動物數（座位是 slot 格）。 */
function seatsIn(index: ContentIndex, mapId: string): number {
  return slotsOf(index.map(mapId)).length;
}
