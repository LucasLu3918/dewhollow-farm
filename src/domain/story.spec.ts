import { describe, expect, it } from 'vitest';
import { chapterReady, currentChapter, pendingSteps, stepDone, type StoryChapter } from './story';

const chapters: StoryChapter[] = [
  {
    id: 'prologue',
    number: 1,
    title: '序章',
    window: '春 1–3',
    phase: 'spring',
    intro: '序章的開場。',
    complete: '序章完成。',
    steps: [
      { hint: '去找毛毛說話', flag: 'talked:maomao' },
      { hint: '開墾一塊田', flag: 'done:till' },
    ],
    reward: { gold: 100, flag: 'main:1' },
    playMinutes: 6,
  },
  {
    id: 'town',
    number: 2,
    title: '鎮上的人',
    window: '春 4–15',
    phase: 'spring',
    intro: '第二章的開場。',
    complete: '第二章完成。',
    steps: [{ hint: '完成一件委託', quest: 'maomao-walk' }],
    reward: { gold: 200, flag: 'main:2' },
    playMinutes: 8,
  },
];

describe('story steps (章節步驟)', () => {
  it('a flag step is done when the flag is true', () => {
    expect(stepDone({ hint: 'x', flag: 'done:till' }, { 'done:till': true }, {})).toBe(true);
    expect(stepDone({ hint: 'x', flag: 'done:till' }, { 'done:till': false }, {})).toBe(false);
    expect(stepDone({ hint: 'x', flag: 'done:till' }, {}, {})).toBe(false);
  });

  it('a quest step is done when that quest is done, not merely accepted', () => {
    const step = { hint: 'x', quest: 'maomao-walk' };
    expect(stepDone(step, {}, { 'maomao-walk': { status: 'done' } })).toBe(true);
    expect(stepDone(step, {}, { 'maomao-walk': { status: 'active' } })).toBe(false);
    expect(stepDone(step, {}, {})).toBe(false);
  });
});

describe('story progression (章節推進)', () => {
  it('the current chapter is the one whose number equals the story counter', () => {
    expect(currentChapter(chapters, { chapter: 1 })?.id).toBe('prologue');
    expect(currentChapter(chapters, { chapter: 2 })?.id).toBe('town');
    expect(currentChapter(chapters, { chapter: 3 })).toBeNull();
  });

  it('a chapter is ready only when every step is done', () => {
    const [prologue] = chapters;
    expect(chapterReady(prologue!, { 'talked:maomao': true }, {})).toBe(false);
    expect(chapterReady(prologue!, { 'talked:maomao': true, 'done:till': true }, {})).toBe(true);
  });

  it('pending steps are the ones not yet done, in order', () => {
    const [prologue] = chapters;
    expect(pendingSteps(prologue!, { 'talked:maomao': true }, {}).map((s) => s.hint)).toEqual(['開墾一塊田']);
    expect(pendingSteps(prologue!, {}, {}).length).toBe(2);
  });
});
