import type { Season } from './calendar';

/**
 * 主線（M5c）：章節與步驟的判斷。步驟只看旗標與委託紀錄，所以章節不需要自己的事件系統。
 * 文字與獎勵在 content/main-quest.json。
 */

/** 一個步驟：旗標為真，或某件委託已經做完（不是只接下）。 */
export type StoryStep = { hint: string; flag: string } | { hint: string; quest: string };

export interface StoryChapter {
  id: string;
  /** 章節號（從 1 開始，連續）。 */
  number: number;
  title: string;
  /** 時機的說明文字，例如「春 1–3」。 */
  window: string;
  /** 內容時數用的季節（見 PLAYTIME_PLAN）。 */
  phase: Season;
  intro: string;
  complete: string;
  steps: StoryStep[];
  reward: { gold?: number; items?: Record<string, number>; flag?: string };
  playMinutes: number;
}

/** 主線進度：目前要完成的章節號。全部章節完成後等於章節數加一。 */
export interface StoryState {
  chapter: number;
}

export function emptyStory(): StoryState {
  return { chapter: 1 };
}

export interface StoryContext {
  flags: Readonly<Record<string, boolean>>;
  quests: Readonly<Record<string, { status: 'active' | 'done' }>>;
}

export function stepDone(step: StoryStep, flags: Readonly<Record<string, boolean>>, quests: StoryContext['quests']): boolean {
  if ('flag' in step) return flags[step.flag] === true;
  return quests[step.quest]?.status === 'done';
}

export function currentChapter(chapters: readonly StoryChapter[], story: StoryState): StoryChapter | null {
  return chapters.find((chapter) => chapter.number === story.chapter) ?? null;
}

export function pendingSteps(chapter: StoryChapter, flags: StoryContext['flags'], quests: StoryContext['quests']): StoryStep[] {
  return chapter.steps.filter((step) => !stepDone(step, flags, quests));
}

export function chapterReady(chapter: StoryChapter, flags: StoryContext['flags'], quests: StoryContext['quests']): boolean {
  return pendingSteps(chapter, flags, quests).length === 0;
}
