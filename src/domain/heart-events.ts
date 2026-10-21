import type { Season } from './calendar';
import type { Period } from './schedule';

/**
 * 心形事件：每 2 顆心觸發一個（春夏每人 2 個）。事件含地點與時段條件、2–3 頁對話、1–2 個選項。
 * 選項改變好感（points），表情泡泡由 emote 指定。事件內容在 content/events.json。
 */

/** 表情泡泡的種類（與 presentation/emote-defs.ts 的 EMOTE_KINDS 一致，由內容檔引用）。 */
export const HEART_EMOTES = ['heart', 'surprise', 'question', 'sweat', 'note', 'sleepy'] as const;
export type HeartEmote = (typeof HEART_EMOTES)[number];

export interface HeartEventOption {
  id: string;
  label: string;
  /** 選了之後顯示的回應。 */
  reply: string;
  /** 好感的變化（點數，負數表示變差）。 */
  points: number;
}

export interface HeartEventDef {
  id: string;
  npcId: string;
  /** 需要的顆心數（好感達到才觸發）。 */
  hearts: number;
  /** 這個事件屬於哪一季（用於時數統計）。 */
  phase: Season;
  /** 地點（地圖 id）與時段；兩者都要符合，居民也要在那裡。 */
  mapId: string;
  periods: Period[];
  emote: HeartEmote;
  /** 對話的每一頁，依序顯示。 */
  pages: string[];
  options: HeartEventOption[];
  /** 內容時數的估計（分鐘），見 docs/PLAYTIME_PLAN.md。 */
  playMinutes: number;
}

export interface HeartEventContext {
  hearts: number;
  mapId: string;
  period: Period;
  triggered: readonly string[];
}

/** 這位居民目前可以觸發的心形事件（顆心最少的先）；沒有就回傳 null。 */
export function readyHeartEvent(events: readonly HeartEventDef[], npcId: string, ctx: HeartEventContext): HeartEventDef | null {
  const ready = events
    .filter((e) => e.npcId === npcId)
    .filter((e) => !ctx.triggered.includes(e.id))
    .filter((e) => ctx.hearts >= e.hearts && e.mapId === ctx.mapId && e.periods.includes(ctx.period))
    .sort((a, b) => a.hearts - b.hearts);
  return ready[0] ?? null;
}
