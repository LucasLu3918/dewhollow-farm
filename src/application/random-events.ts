import type { GameState } from '../domain/game-state';
import { totalDay } from '../domain/calendar';
import { addItem } from '../domain/inventory';
import { rollDailyEvent, type RandomEventDef } from '../domain/random-events';
import type { Period } from '../domain/schedule';
import type { ContentIndex } from './content-index';

/**
 * 隨機事件的套用（M5d）：睡醒時決定今天的事件並入袋（白天）、睡前入袋（夜間），
 * 採集與釣魚的加成、居民的音樂會位置都從「今天的事件」查。規則在 domain/random-events.ts。
 */

export interface EventOutcome {
  state: GameState;
  messages: string[];
}

/** 今天的事件（狀態裡記的是今天的，不是今天就沒有）；沒有就是 null。 */
export function todayEvent(state: GameState, index: ContentIndex): RandomEventDef | null {
  const id = state.dailyEvent.id;
  if (id === null || state.dailyEvent.day !== totalDay(state.calendar, index.tuning.time.daysPerSeason)) return null;
  return index.randomEvents.events.find((e) => e.id === id) ?? null;
}

/** 今天某項採集動作多得一件的機率加成（0 到 1）。 */
export function eventYieldChance(state: GameState, index: ContentIndex, action: 'harvest' | 'forage' | 'chop' | 'mine'): number {
  const event = todayEvent(state, index);
  if (!event || event.effect.type !== 'yield' || event.effect.action !== action) return 0;
  return event.effect.chance;
}

/** 今天釣魚上鉤機率的加成（百分點）。 */
export function eventBitePoints(state: GameState, index: ContentIndex): number {
  const event = todayEvent(state, index);
  if (!event || event.effect.type !== 'bite') return 0;
  return event.effect.points;
}

/** 這個時段有音樂會的話，回傳地點與居民的位置（見 residents.ts）；否則 null。 */
export function concertNow(state: GameState, index: ContentIndex, period: Period): { mapId: string; spots: { npcId: string; x: number; y: number }[] } | null {
  const event = todayEvent(state, index);
  if (!event || event.effect.type !== 'concert' || event.effect.period !== period) return null;
  return { mapId: event.effect.mapId, spots: event.effect.spots };
}

/**
 * 睡醒：以新的一天的日期與天氣決定今天的事件並記下來；白天的物品事件現在入袋。
 */
export function startDay(state: GameState, index: ContentIndex): EventOutcome {
  const event = rollDailyEvent(index.randomEvents, state.calendar, state.weather, index.tuning.time.daysPerSeason);
  const today = totalDay(state.calendar, index.tuning.time.daysPerSeason);
  const next: GameState = { ...state, dailyEvent: { day: today, id: event?.id ?? null } };
  if (!event) return { state: next, messages: [] };
  const messages = [`今天發生了${event.name}。${event.message}`];
  if (event.period === 'day' && event.effect.type === 'grant') {
    const granted = grantItems(next, event.effect.items, index);
    messages.push(...granted.messages);
    return { state: granted.state, messages };
  }
  return { state: next, messages };
}

/**
 * 睡覺（天黑）：今天的夜間事件（例如流星）在睡前入袋。沒有夜間事件就原樣回傳。
 */
export function endOfDay(state: GameState, index: ContentIndex): EventOutcome {
  const event = todayEvent(state, index);
  if (!event || event.period !== 'night' || event.effect.type !== 'grant') return { state, messages: [] };
  const granted = grantItems(state, event.effect.items, index);
  return { state: granted.state, messages: [event.message, ...granted.messages] };
}

/** 物品入袋：放得下的入袋，放不下的略過並說明（事件不能卡住睡覺）。 */
function grantItems(state: GameState, items: Record<string, number>, index: ContentIndex): EventOutcome {
  let inventory = state.inventory;
  const got: string[] = [];
  let missed = false;
  for (const [itemId, count] of Object.entries(items)) {
    const stored = addItem(inventory, index.item(itemId), count);
    if (!stored.ok) {
      missed = true;
      continue;
    }
    inventory = stored.value;
    got.push(`${index.item(itemId).name} × ${count}`);
  }
  const messages: string[] = [];
  if (got.length > 0) messages.push(`獲得 ${got.join('、')}`);
  if (missed) messages.push('背包放不下，有些東西沒有入袋');
  return { state: { ...state, inventory }, messages };
}
