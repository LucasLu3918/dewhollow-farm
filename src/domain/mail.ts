import type { Calendar, Season } from './calendar';
import { totalDay } from './calendar';
import { unlockMet, type QuestUnlock, type UnlockContext } from './quests';

/**
 * 信箱（M5b）：居民每天早上寫來的信。信件內容在 content/letters.json；
 * 信在到期日之後、條件符合的早上送進信箱，之後由玩家到信箱前取信（未讀變已讀）。
 */
export interface LetterDef {
  id: string;
  /** 寄信的居民 id。 */
  from: string;
  title: string;
  body: string[];
  /** 這封信屬於哪一季（用於時數統計）。 */
  phase: Season;
  /** 內容時數的估計（分鐘）。 */
  playMinutes: number;
  /** 最早寄出的日期（季與日）；省略表示隨時。 */
  due?: { season: Season; day: number };
  /** 寄出的條件（好感、旗標、心形事件）；省略表示沒有條件。 */
  unlock?: QuestUnlock;
}

export type LetterStatus = 'unread' | 'read';

export function letterDue(letter: Pick<LetterDef, 'due'>, calendar: Calendar, daysPerSeason: number): boolean {
  if (!letter.due) return true;
  const opensOn = totalDay({ year: 1, season: letter.due.season, day: letter.due.day, minuteOfDay: 0 }, daysPerSeason);
  return totalDay(calendar, daysPerSeason) >= opensOn;
}

/**
 * 今天早上會送進信箱的信：還沒送過、已經到期、條件也符合。
 * 條件不符的信留到之後的早上再送（不會因此消失）。
 */
export function deliverableLetters(
  letters: readonly LetterDef[],
  mail: Readonly<Record<string, LetterStatus>>,
  ctx: UnlockContext,
  calendar: Calendar,
  daysPerSeason: number,
): LetterDef[] {
  return letters.filter((letter) => mail[letter.id] === undefined && letterDue(letter, calendar, daysPerSeason) && unlockMet(letter.unlock, ctx));
}
