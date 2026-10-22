import type { GameState } from '../domain/game-state';
import {
  CROWN_RECIPE,
  doneThisYear,
  exchangeRefusal,
  festivalKey,
  markDone,
  openFestival,
  recordCatch,
  recordExchange,
  recordSale,
  soldThisYear,
  contestReached,
  harvestContestReached,
  lanternKey,
  lanternKeysOf,
  litLanterns,
  recordHarvest,
  warmGiftsLeft,
  WARM_GIFT_LINE,
  type ExchangeContext,
  type FestivalDef,
  type StarExchangeDef,
} from '../domain/festival';
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

/**
 * 收成比賽（豐穗祭）：節慶當天收成指定的作物，就把收成的數量記下來；累計達到目標且今年還沒領過，發獎勵。
 * 不會失敗：不是比賽的作物或不是節慶當天，就什麼都不做。
 */
export function recordHarvestContest(state: GameState, cropId: string, count: number, index: ContentIndex): FestivalOutcome {
  const festival = openFestival(index.festivals, state.calendar);
  const contest = festival?.harvestContest;
  if (!festival || !contest || contest.cropId !== cropId) return { state, messages: [] };
  const year = state.calendar.year;
  let next: GameState = { ...state, festival: { ...state.festival, harvest: recordHarvest(state.festival.harvest, year, count) } };
  const messages: string[] = [];
  const key = festivalKey(festival.id, 'contest');
  if (harvestContestReached(next.festival.harvest, contest) && !doneThisYear(next.festival, key, year)) {
    next = {
      ...next,
      gold: next.gold + contest.gold,
      festival: markDone(next.festival, key, year),
      flags: { ...next.flags, [`attended:${festival.id}`]: true },
    };
    messages.push(`收成比賽完成！獎勵 ${contest.gold} 金`);
  }
  return { state: next, messages };
}

/**
 * 暖燈節點燈：站在廣場的燈前按互動。每盞每年一次；點亮發燈的獎勵，全部點亮時再發一次獎勵並設定旗標。
 * 不花體力與時間。已經點過或不是節慶時間，什麼都不改。
 */
export function lightLantern(state: GameState, lampKey: string, index: ContentIndex): Result<FestivalOutcome, string> {
  const festival = festivalHere(state, index);
  const lamps = festival?.lanterns;
  if (!festival || !lamps) return fail('NOT_FESTIVAL');
  const year = state.calendar.year;
  const key = lanternKey(festival.id, lampKey);
  if (doneThisYear(state.festival, key, year)) return fail('ALREADY_LIT');

  let next: GameState = {
    ...state,
    gold: state.gold + lamps.gold,
    festival: markDone(state.festival, key, year),
    flags: { ...state.flags, [`attended:${festival.id}`]: true },
  };
  const messages = [`點亮了一盞燈，獎勵 ${lamps.gold} 金`];
  const lit = litLanterns(next.festival.done, festival.id, lanternKeysOf(index.map(state.mapId)), year);
  if (lit >= lamps.count && next.flags[lamps.flag] !== true) {
    next = { ...next, gold: next.gold + lamps.allGold, flags: { ...next.flags, [lamps.flag]: true } };
    messages.push(`廣場上全部的燈都亮了！獎勵 ${lamps.allGold} 金`);
  }
  return ok({ state: next, messages });
}

/**
 * 暖燈禮物：暖燈節當晚、鎮廣場上，指定的居民收禮不受每日一次限制，今年還有次數就算。
 * 不是這樣的情況就回傳 false，送禮照常走每日一次的規則。
 */
export function warmGiftOpen(state: GameState, index: ContentIndex, npcId: string): boolean {
  const rules = festivalHere(state, index)?.giftExchange;
  if (!rules || !rules.npcIds.includes(npcId)) return false;
  return warmGiftsLeft(state.festival.exchanged, state.calendar.year, rules.perYear) > 0;
}

/** 暖燈禮物用掉一次（今年的計次加一）。 */
export function recordWarmGift(state: GameState): GameState {
  return { ...state, festival: { ...state.festival, exchanged: recordExchange(state.festival.exchanged, state.calendar.year, WARM_GIFT_LINE) } };
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

/** 星河兌換的項目（節慶當天、在鎮廣場才有）；找不到就是 null。 */
function exchangeLine(state: GameState, index: ContentIndex, lineId: string): StarExchangeDef | null {
  const festival = festivalHere(state, index);
  return festival?.exchange?.find((line) => line.id === lineId) ?? null;
}

function exchangeContext(state: GameState, line: StarExchangeDef): ExchangeContext {
  return {
    shards: countOf(state.inventory, line.give.itemId),
    year: state.calendar.year,
    exchanged: state.festival.exchanged,
    flagSet: line.flag !== undefined && state.flags[line.flag] === true,
  };
}

/**
 * 星河兌換的拒絕原因（失敗代碼），或 null 表示可以換。節慶面板也用它決定按鈕與說明文字。
 * 不是節慶時間、不在鎮廣場、沒有這一項，都會拒絕。
 */
export function starExchangeRefusal(state: GameState, index: ContentIndex, lineId: string): string | null {
  if (!festivalHere(state, index)) return 'NOT_FESTIVAL';
  const line = exchangeLine(state, index, lineId);
  if (!line) return 'NO_EXCHANGE';
  return exchangeRefusal(line, exchangeContext(state, line));
}

/**
 * 星河兌換：付出碎片（或別的素材），換到物品或解鎖旗標。每項每年有上限；碎片跨年保留。
 * 不花體力與時間。拒絕時什麼都不會被扣。
 */
export function starExchange(state: GameState, lineId: string, index: ContentIndex): Result<FestivalOutcome, string> {
  const festival = festivalHere(state, index);
  if (!festival) return fail('NOT_FESTIVAL');
  const line = festival.exchange?.find((l) => l.id === lineId);
  if (!line) return fail('NO_EXCHANGE');
  const refusal = exchangeRefusal(line, exchangeContext(state, line));
  if (refusal) return fail(refusal);

  const taken = removeItem(state.inventory, line.give.itemId, line.give.count);
  if (!taken.ok) return fail('NOT_ENOUGH_SHARDS');
  let inventory = taken.value;
  if (line.receive) {
    const stored = addItem(inventory, index.item(line.receive.itemId), line.receive.count);
    if (!stored.ok) return fail('BAG_FULL');
    inventory = stored.value;
  }
  const year = state.calendar.year;
  const next: GameState = {
    ...state,
    inventory,
    festival: { ...state.festival, exchanged: recordExchange(state.festival.exchanged, year, line.id) },
    flags: { ...state.flags, ...(line.flag !== undefined ? { [line.flag]: true } : {}), [`attended:${festival.id}`]: true },
  };
  const give = `${index.item(line.give.itemId).name} × ${line.give.count}`;
  const message = line.receive
    ? `星河兌換：給出 ${give}，得到 ${index.item(line.receive.itemId).name} × ${line.receive.count}`
    : `星河兌換：給出 ${give}，${line.name}已經解鎖`;
  return ok({ state: next, messages: [message] });
}

/** 攤位成交後記下賣了幾個（只有有限量的物品才記）。 */
export function recordStallSale(state: GameState, index: ContentIndex, shopId: string, itemId: string, count: number): GameState {
  const line = index.shop(shopId).stock.find((s) => s.itemId === itemId);
  if (line?.limit === undefined) return state;
  return { ...state, festival: { ...state.festival, sold: recordSale(state.festival.sold, state.calendar.year, itemId, count) } };
}
