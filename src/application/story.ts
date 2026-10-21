import type { GameState } from '../domain/game-state';
import { addItem } from '../domain/inventory';
import { currentChapter, chapterReady, pendingSteps, type StoryChapter } from '../domain/story';
import type { ContentIndex } from './content-index';

/**
 * 主線的用例（M5c）：每個指令之後檢查目前的章節，步驟都達成就發獎勵並推進到下一章。
 * 步驟與獎勵的內容在 content/main-quest.json；規則（哪些步驟算完成）在 domain/story.ts。
 */

export interface StoryOutcome {
  state: GameState;
  messages: string[];
}

/** 章節的獎勵：金幣、物品（放不下就不算完成）與旗標。 */
function grant(state: GameState, chapter: StoryChapter, index: ContentIndex): GameState | null {
  let next: GameState = { ...state, gold: state.gold + (chapter.reward.gold ?? 0) };
  for (const [itemId, count] of Object.entries(chapter.reward.items ?? {})) {
    const stored = addItem(next.inventory, index.item(itemId), count);
    if (!stored.ok) return null;
    next = { ...next, inventory: stored.value };
  }
  if (chapter.reward.flag) next = { ...next, flags: { ...next.flags, [chapter.reward.flag]: true } };
  return next;
}

/**
 * 依序檢查章節：目前的章節達成就完成（發獎勵、推進章節號），再看下一章。
 * 獎勵放不下時章節留在原處，騰出空間後的下一個指令會再試。
 */
export function settleStory(state: GameState, index: ContentIndex): StoryOutcome {
  let current = state;
  const messages: string[] = [];
  for (;;) {
    const chapter = currentChapter(index.chapters, current.story);
    if (!chapter || !chapterReady(chapter, current.flags, current.quests)) break;
    const granted = grant(current, chapter, index);
    if (!granted) break;
    current = { ...granted, story: { chapter: chapter.number + 1 } };
    messages.push(`主線第 ${chapter.number} 章完成：${chapter.title}`, chapter.complete);
    const next = currentChapter(index.chapters, current.story);
    if (next) messages.push(`新的章節：${next.title}。${next.intro}`);
  }
  return { state: current, messages };
}

/** 目前的主線目標（給睡醒時的提示），例如「主線：第 1 章，還要：開墾一塊田」；沒有章節了就是 null。 */
export function storyObjective(state: GameState, index: ContentIndex): string | null {
  const chapter = currentChapter(index.chapters, state.story);
  if (!chapter) return null;
  const left = pendingSteps(chapter, state.flags, state.quests).map((step) => step.hint);
  return `主線第 ${chapter.number} 章「${chapter.title}」，還要：${left.join('、')}`;
}
