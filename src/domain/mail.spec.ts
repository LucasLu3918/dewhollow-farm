import { describe, expect, it } from 'vitest';
import type { Calendar } from './calendar';
import { deliverableLetters, letterDue, type LetterDef } from './mail';
import type { UnlockContext } from './quests';

const letters: LetterDef[] = [
  { id: 'early', from: 'maomao', title: '早', body: ['早安。'], phase: 'spring', playMinutes: 0.5, due: { season: 'spring', day: 4 } },
  { id: 'late', from: 'maomao', title: '晚', body: ['晚安。'], phase: 'summer', playMinutes: 0.5, due: { season: 'summer', day: 1 } },
  { id: 'gated', from: 'rong-bo', title: '閘', body: ['你好。'], phase: 'spring', playMinutes: 0.5, unlock: { hearts: { npcId: 'rong-bo', hearts: 2 } } },
  { id: 'anytime', from: 'a-gan', title: '隨時', body: ['嗨。'], phase: 'spring', playMinutes: 0.5 },
];

const open: UnlockContext = { hearts: () => 2, flags: {}, heartEvents: [], mail: {} };
const closed: UnlockContext = { hearts: () => 0, flags: {}, heartEvents: [], mail: {} };

function on(season: Calendar['season'], day: number): Calendar {
  return { year: 1, season, day, minuteOfDay: 360 };
}

describe('信件的到期日（letterDue）', () => {
  it('沒有到期日的信隨時到期；有到期日的信要到那一天（含）以後', () => {
    expect(letterDue(letters[3]!, on('spring', 1), 20)).toBe(true);
    expect(letterDue(letters[0]!, on('spring', 3), 20)).toBe(false);
    expect(letterDue(letters[0]!, on('spring', 4), 20)).toBe(true);
    expect(letterDue(letters[1]!, on('spring', 20), 20)).toBe(false);
    expect(letterDue(letters[1]!, on('summer', 1), 20)).toBe(true);
  });
});

describe('早上送到信箱的信（deliverableLetters）', () => {
  it('到期、條件符合、還沒送過的信才會送到', () => {
    const arrived = deliverableLetters(letters, {}, open, on('summer', 2), 20).map((l) => l.id);
    expect(arrived).toEqual(['early', 'late', 'gated', 'anytime']);
  });

  it('條件不符（好感不夠）的信留到之後的早上再送', () => {
    expect(deliverableLetters(letters, {}, closed, on('spring', 5), 20).map((l) => l.id)).toEqual(['early', 'anytime']);
  });

  it('已經送過的信（不論已讀或未讀）不會再送', () => {
    const mail = { early: 'unread' as const, anytime: 'read' as const };
    expect(deliverableLetters(letters, mail, open, on('spring', 5), 20).map((l) => l.id)).toEqual(['gated']);
  });
});
