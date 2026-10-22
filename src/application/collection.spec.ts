import { describe, expect, it } from 'vitest';
import { createNewGame, type GameState } from '../domain/game-state';
import { addItem, createInventory } from '../domain/inventory';
import type { GameEvent } from './game-commands';
import { shippedIndex, shippedPack } from '../../tests/sim/shipped-content';
import { observeProgress } from './collection';

/**
 * M5d：圖鑑與成就的用例（觀察指令的結果，發現條目、推進計數、發獎勵）。使用真實內容。
 */

function game(overrides: Partial<GameState> = {}): GameState {
  return { ...createNewGame(shippedPack, 7), ...overrides };
}

/** 背包裡只有指定物品（格數夠大）。 */
function withItems(state: GameState, items: Record<string, number>, capacity = 60): GameState {
  let inventory = createInventory(capacity);
  for (const [itemId, count] of Object.entries(items)) {
    const stored = addItem(inventory, shippedIndex.item(itemId), count);
    if (!stored.ok) throw new Error(`背包放不下 ${itemId}`);
    inventory = stored.value;
  }
  return { ...state, inventory };
}

function observe(before: GameState, after: GameState, events: GameEvent[] = []) {
  return observeProgress(before, after, events, shippedIndex);
}

const HARVEST: GameEvent = { type: 'acted', action: 'harvest', x: 4, y: 3 };

describe('圖鑑：首次取得才計入（取得 = 背包或牛舍、雞舍裡的數量增加）', () => {
  it('新釣到的魚會被記在圖鑑上，並列出一則發現的訊息', () => {
    const before = game();
    const after = withItems(before, { 'fish.carp': 1 });
    const out = observe(before, after);
    expect(out.state.collection.found).toEqual(['fish.carp']);
    expect(out.messages.join('\n')).toContain('鯉魚');
  });

  it('舊存檔已經有的東西不回補：數量沒有增加就不計入', () => {
    const before = withItems(game(), { 'fish.carp': 3 });
    const out = observe(before, before);
    expect(out.state.collection.found).toEqual([]);
  });

  it('蛋、木材這類不在圖鑑類別裡的東西不計入', () => {
    const before = game();
    const out = observe(before, withItems(before, { wood: 5, egg: 2 }));
    expect(out.state.collection.found).toEqual([]);
  });

  it('買到的動物（雞、牛）記在動物類別，用的是牛舍與雞舍的隊伍', () => {
    const before = game();
    const after = { ...before, animals: [{ kind: 'chicken', fed: false, petted: false, milked: false, mood: 5 }] };
    expect(observe(before, after).state.collection.found).toEqual(['animal.chicken']);
  });
});

describe('成就：計數器與只給一次', () => {
  it('第一次收成：收成計數加一，解鎖「第一次收成」並給金幣；之後再收成不會重複給', () => {
    const before = game({ gold: 0 });
    const first = observe(before, before, [HARVEST]);
    expect(first.state.achievements.counters.harvest).toBe(1);
    expect(first.state.achievements.unlocked).toContain('first-harvest');
    expect(first.state.gold).toBe(50);
    expect(first.messages.join('\n')).toContain('第一次收成');

    const second = observe(first.state, first.state, [HARVEST]);
    expect(second.state.achievements.counters.harvest).toBe(2);
    expect(second.state.gold).toBe(50);
    expect(second.state.achievements.unlocked.filter((id) => id === 'first-harvest')).toHaveLength(1);
  });

  it('合成一件東西（crafted 事件）解鎖「第一次合成」', () => {
    const before = game({ gold: 0 });
    const out = observe(before, before, [{ type: 'crafted', recipeId: 'vase' }]);
    expect(out.state.achievements.unlocked).toContain('first-craft');
    expect(out.state.gold).toBe(40);
  });

  it('送禮、出貨（acted ship）各自推進計數', () => {
    const before = game();
    const out = observe(before, before, [
      { type: 'gifted', npcId: 'maomao', reaction: 'love' },
      { type: 'acted', action: 'ship', x: 1, y: 1 },
    ]);
    expect(out.state.achievements.counters).toMatchObject({ gift: 1, ship: 1 });
  });
});

describe('圖鑑獎勵：達到門檻才領，領一次', () => {
  it('八種魚發現兩種，就領 25% 的金幣；再發現也不重複給', () => {
    const before = game({ gold: 0 });
    const after = withItems(before, { 'fish.carp': 1, 'fish.bass': 1 });
    const out = observe(before, after);
    // 100 金是圖鑑 25% 的獎勵；另外 50 金是「第一條魚」成就（同一次達成）。
    expect(out.state.gold).toBe(150);
    expect(out.state.collection.claimed).toContain('fish:25');
    expect(out.messages.join('\n')).toContain('圖鑑 魚 達到 25%');
    const again = observe(out.state, out.state);
    expect(again.state.gold).toBe(150);
  });

  it('背包放不下的裝飾獎勵不算領到，等騰出空間後的下一次指令再給', () => {
    const before = game({ gold: 0 });
    const fish = { 'fish.carp': 1, 'fish.crucian': 1, 'fish.bass': 1, 'fish.reed-catfish': 1 };
    const full = observe(before, withItems(before, fish, 4));
    expect(full.state.collection.claimed).toContain('fish:25');
    expect(full.state.collection.claimed).not.toContain('fish:50');
    expect(full.state.inventory.stacks.some((s) => s.itemId === 'night-canvas')).toBe(false);

    // 騰出空間（同樣的魚，背包格數夠大）後，下一次指令就會把裝飾給出去。
    const later = observe(full.state, withItems(full.state, fish, 60));
    expect(later.state.collection.claimed).toContain('fish:50');
    expect(later.state.inventory.stacks.some((s) => s.itemId === 'night-canvas')).toBe(true);
  });
});
