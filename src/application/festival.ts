import type { GameState } from '../domain/game-state';
import { CROWN_RECIPE, doneThisYear, festivalKey, markDone, openFestival, recordCatch, recordSale, soldThisYear, contestReached, type FestivalDef } from '../domain/festival';
import { addItem, countOf, removeItem } from '../domain/inventory';
import { fail, ok, type Result } from '../domain/result';
import type { ContentIndex } from './content-index';
import { residentsOn } from './residents';

/**
 * 節慶的用例（M5c）：種子交換、花冠製作、釣魚比賽計數、夜市攤位。規則在 domain（festival.ts），
 * 這裡把規則套到遊戲狀態上：地點、居民是否在場、材料、紀錄與獎勵。不花體力，除非呼叫端說明。
 */

export interface FestivalOutcome {
  state: GameState;
  messages: string[];
}

/** 此刻在這張地圖上進行的節慶（時段與地點都要對）；沒有就是 null。 */
export function festivalHere(state: GameState, index: ContentIndex): FestivalDef | null {
  const open = openFestival(index.festivals, state.calendar);
  return open && open.mapId === state.mapId ? open : null;
}

/** 種子交換：節慶當天在鎮廣場，居民此刻也在廣場，每人每年一次。 */
export function festivalSwap(state: GameState, npcId: string, index: ContentIndex): Result<FestivalOutcome, string> {
  const festival = festivalHere(state, index);
  if (!festival) return fail('NOT_FESTIVAL');
  const swap = festival.swaps?.find((s) => s.npcId === npcId);
  if (!swap) return fail('NO_SWAP');
  const year = state.calendar.year;
  const key = festivalKey(festival.id, 'swap', npcId);
  if (doneThisYear(state.festival, key, year)) return fail('ALREADY_THIS_YEAR');
  if (!residentsOn(state, index).some((r) => r.npcId === npcId)) return fail('NOT_PRESENT');
  if (countOf(state.inventory, swap.give.itemId) < swap.give.count) return fail('NO_MATERIAL');

  const taken = removeItem(state.inventory, swap.give.itemId, swap.give.count);
  if (!taken.ok) return fail('NO_MATERIAL');
  const stored = addItem(taken.value, index.item(swap.receive.itemId), swap.receive.count);
  if (!stored.ok) return fail('BAG_FULL');
  const next: GameState = {
    ...state,
    inventory: stored.value,
    festival: markDone(state.festival, key, year),
    flags: { ...state.flags, [`attended:${festival.id}`]: true },
  };
  const npc = index.npc(npcId);
  const give = `${index.item(swap.give.itemId).name} × ${swap.give.count}`;
  const receive = `${index.item(swap.receive.itemId).name} × ${swap.receive.count}`;
  return ok({ state: next, messages: [`${npc.name}和你交換了種子：給出 ${give}，得到 ${receive}`] });
}

/**
 * 花冠製作：節慶當天在鎮廣場，用合成配方的材料做一個花冠。
 * 每年第一次做會得到節慶的獎勵（金幣）；之後照樣能做，只是沒有獎勵。
 */
export function festivalCrown(state: GameState, index: ContentIndex): Result<FestivalOutcome, string> {
  const festival = festivalHere(state, index);
  if (!festival?.crown) return fail('NOT_FESTIVAL');
  const recipe = index.craftingRecipe(CROWN_RECIPE);
  const missing = Object.entries(recipe.ingredients).some(([itemId, count]) => countOf(state.inventory, itemId) < count);
  if (missing) return fail('NO_MATERIAL');

  let inventory = state.inventory;
  for (const [itemId, count] of Object.entries(recipe.ingredients)) {
    const taken = removeItem(inventory, itemId, count);
    if (!taken.ok) return fail('NO_MATERIAL');
    inventory = taken.value;
  }
  if (!recipe.output) return fail('NO_MATERIAL');
  const stored = addItem(inventory, index.item(recipe.output.item), recipe.output.count);
  if (!stored.ok) return fail('BAG_FULL');

  const year = state.calendar.year;
  const key = festivalKey(festival.id, 'crown');
  const first = !doneThisYear(state.festival, key, year);
  const next: GameState = {
    ...state,
    inventory: stored.value,
    gold: first ? state.gold + festival.crown.gold : state.gold,
    festival: first ? markDone(state.festival, key, year) : state.festival,
    flags: first ? { ...state.flags, [`attended:${festival.id}`]: true } : state.flags,
  };
  const messages = [`做好了${index.item(recipe.output.item).name}`];
  if (first) messages.push(`節慶獎勵：${festival.crown.gold} 金`);
  return ok({ state: next, messages });
}

/**
 * 釣到一條魚時：如果此刻有釣魚比賽的節慶，就計數；達到目標且今年還沒領過，發獎勵。
 * 不會失敗：沒有比賽就什麼都不做。
 */
export function recordContestCatch(state: GameState, index: ContentIndex): FestivalOutcome {
  const festival = openFestival(index.festivals, state.calendar);
  if (!festival?.contest) return { state, messages: [] };
  const year = state.calendar.year;
  const contest = recordCatch(state.festival.contest, year);
  let next: GameState = { ...state, festival: { ...state.festival, contest } };
  const messages: string[] = [];
  const key = festivalKey(festival.id, 'contest');
  if (contestReached(contest, festival.contest) && !doneThisYear(next.festival, key, year)) {
    next = {
      ...next,
      gold: next.gold + festival.contest.gold,
      festival: markDone(next.festival, key, year),
      flags: { ...next.flags, [`attended:${festival.id}`]: true },
    };
    messages.push(`釣魚比賽完成！獎勵 ${festival.contest.gold} 金`);
  }
  return { state: next, messages };
}

/** 夜市攤位：現在是不是這個攤位的節慶、而且這次買得下（限量）。回傳失敗代碼，或 null 表示可以買。 */
export function stallRefusal(state: GameState, index: ContentIndex, shopId: string, itemId: string, count: number): string | null {
  const shop = index.shop(shopId);
  if (shop.festival === undefined) return null;
  const festival = festivalHere(state, index);
  if (!festival || festival.id !== shop.festival) return 'STALL_CLOSED';
  const line = shop.stock.find((s) => s.itemId === itemId);
  if (line?.limit === undefined) return null;
  const sold = soldThisYear(state.festival.sold, state.calendar.year, itemId);
  return sold + count > line.limit ? 'SOLD_OUT' : null;
}

/** 攤位成交後記下賣了幾個（只有有限量的物品才記）。 */
export function recordStallSale(state: GameState, index: ContentIndex, shopId: string, itemId: string, count: number): GameState {
  const line = index.shop(shopId).stock.find((s) => s.itemId === itemId);
  if (line?.limit === undefined) return state;
  return { ...state, festival: { ...state.festival, sold: recordSale(state.festival.sold, state.calendar.year, itemId, count) } };
}
