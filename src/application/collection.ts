import type { GameState } from '../domain/game-state';
import { addItem, type Inventory } from '../domain/inventory';
import { heartsOf } from '../domain/friendship';
import { receiveGold } from '../domain/income';
import { categoryCount, claimKey, discoverEntries, dueRewards, markClaimed, type DexReward } from '../domain/collection';
import { bumpCounter, markUnlocked, newlyUnlocked, type AchievementContext } from '../domain/achievements';
import type { GameEvent } from './game-commands';
import type { ContentIndex } from './content-index';

/**
 * 圖鑑與成就的觀察者（M5d）：每個指令之後，看前後兩個狀態與指令的事件，
 * 1) 新取得的條目記進圖鑑（背包或牛舍、雞舍裡的數量比之前多，才算首次取得；舊存檔的東西不回補）；
 * 2) 推進計數器（收成、出貨、送禮、委託、合成）；
 * 3) 圖鑑達到門檻就發獎勵（放不下背包就不領，下一次指令再試）；
 * 4) 成就條件達成就發獎勵（每個成就只給一次）。
 * 規則在 domain（collection.ts、achievements.ts），內容在 content/*.json。
 */

export interface ProgressOutcome {
  state: GameState;
  messages: string[];
}

/** 背包裡每種物品的數量。 */
function countsOf(inventory: Inventory): Map<string, number> {
  const counts = new Map<string, number>();
  for (const stack of inventory.stacks) counts.set(stack.itemId, (counts.get(stack.itemId) ?? 0) + stack.count);
  return counts;
}

/** 這個指令中首次取得的圖鑑條目（數量增加，或是新買的動物種類）。 */
export function gainedEntries(before: GameState, after: GameState, index: ContentIndex): string[] {
  const dexIds = new Set(index.dexCategories.flatMap((c) => c.entries));
  const was = countsOf(before.inventory);
  const now = countsOf(after.inventory);
  const gained: string[] = [];
  for (const [itemId, count] of now) {
    if (dexIds.has(itemId) && count > (was.get(itemId) ?? 0)) gained.push(itemId);
  }
  const kindsOf = (state: GameState) => new Set([...state.animals, ...state.cows, ...state.sheep].map((a) => `animal.${a.kind}`));
  const had = kindsOf(before);
  for (const id of kindsOf(after)) {
    if (!had.has(id) && dexIds.has(id)) gained.push(id);
  }
  return gained;
}

function entryName(id: string, index: ContentIndex): string {
  return id.startsWith('animal.') ? index.animal(id.slice('animal.'.length)).name : index.item(id).name;
}

/** 成就條件要看的狀態（由遊戲狀態組出來）。 */
export function achievementContext(state: GameState, index: ContentIndex): AchievementContext {
  return {
    counters: state.achievements.counters,
    flags: state.flags,
    dexCount: (categoryId) => {
      const category = index.dexCategories.find((c) => c.id === categoryId);
      return category ? categoryCount(category, state.collection.found) : 0;
    },
    hearts: (npcId) => heartsOf(state.friendship[npcId]?.points ?? 0, index.friendship),
    residents: index.npcs.map((n) => n.id),
  };
}

/** 圖鑑獎勵的內容：金錢、裝飾（放不下就回傳 null，不算領到）、稱號。 */
function grantDexReward(state: GameState, reward: DexReward, index: ContentIndex): GameState | null {
  let inventory = state.inventory;
  for (const [itemId, count] of Object.entries(reward.items ?? {})) {
    const stored = addItem(inventory, index.item(itemId), count);
    if (!stored.ok) return null;
    inventory = stored.value;
  }
  const titles = reward.title ? [...state.achievements.titles, reward.title] : state.achievements.titles;
  return { ...receiveGold(state, reward.gold ?? 0), inventory, achievements: { ...state.achievements, titles } };
}

function rewardText(gold: number | undefined, title: string | undefined, items: Record<string, number> | undefined, index: ContentIndex): string {
  const parts: string[] = [];
  if (gold) parts.push(`${gold} 金`);
  for (const [itemId, count] of Object.entries(items ?? {})) parts.push(`${index.item(itemId).name} × ${count}`);
  if (title) parts.push(`稱號「${title}」`);
  return parts.length > 0 ? `（獲得 ${parts.join('、')}）` : '';
}

/**
 * 觀察一個指令的結果：發現條目、推進計數、發圖鑑與成就的獎勵。沒有變化時狀態與原來相同。
 */
export function observeProgress(before: GameState, after: GameState, events: readonly GameEvent[], index: ContentIndex): ProgressOutcome {
  const messages: string[] = [];

  // 1) 首次取得的條目。
  const gained = gainedEntries(before, after, index);
  const collection = discoverEntries(after.collection, gained);
  for (const id of gained) {
    if (!after.collection.found.includes(id)) messages.push(`圖鑑新條目：${entryName(id, index)}`);
  }

  // 2) 計數器：收成、出貨、送禮、合成由事件推進；委託是剛完成的（之前不是完成）。
  let achievements = after.achievements;
  for (const event of events) {
    if (event.type === 'acted' && event.action === 'harvest') achievements = bumpCounter(achievements, 'harvest', 1);
    if (event.type === 'acted' && event.action === 'ship') achievements = bumpCounter(achievements, 'ship', 1);
    if (event.type === 'gifted') achievements = bumpCounter(achievements, 'gift', 1);
    if (event.type === 'crafted') achievements = bumpCounter(achievements, 'craft', 1);
  }
  const finishedQuests = Object.keys(after.quests).filter((id) => after.quests[id]?.status === 'done' && before.quests[id]?.status !== 'done').length;
  achievements = bumpCounter(achievements, 'quest', finishedQuests);

  let next: GameState = { ...after, collection, achievements };

  // 3) 圖鑑的門檻獎勵（放不下背包的裝飾不算領到，之後再給）。
  for (const category of index.dexCategories) {
    for (const reward of dueRewards(category, next.collection.found, next.collection.claimed)) {
      const granted = grantDexReward(next, reward, index);
      if (!granted) continue;
      next = { ...granted, collection: markClaimed(next.collection, [claimKey(category.id, reward.percent)]) };
      messages.push(`圖鑑 ${category.name} 達到 ${reward.percent}%${rewardText(reward.gold, reward.title, reward.items, index)}`);
    }
  }

  // 4) 成就：條件達成就發獎勵，每個只給一次。
  for (const def of newlyUnlocked(index.achievements, next.achievements, achievementContext(next, index))) {
    next = { ...receiveGold(next, def.reward.gold ?? 0), achievements: markUnlocked(next.achievements, def) };
    messages.push(`成就達成：${def.name}${rewardText(def.reward.gold, def.reward.title, undefined, index)}`);
  }

  return { state: next, messages };
}
