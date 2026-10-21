import type { GameEvent } from '../application/game-commands';

/**
 * 表情氣泡的定義與「哪個事件、誰、顯示什麼」的對應：純資料與純函式，不依賴 Phaser。
 * 不產圖：符號簡單，在 24 px 左右的尺寸用程式畫最銳利；顏色全取自共用調色盤（有測試），
 * 所以新增表情不需要為新顏色重新量化任何素材。繪製見 emote.ts。
 */

export const EMOTE_KINDS = ['heart', 'surprise', 'question', 'sweat', 'note', 'sleepy'] as const;
export type EmoteKind = (typeof EMOTE_KINDS)[number];

export interface EmoteDef {
  kind: EmoteKind;
  /** 符號的顏色。 */
  icon: string;
  /** 氣泡外框（共用調色盤的輪廓色）。 */
  outline: string;
  /** 氣泡底色（共用調色盤的暖白）。 */
  fill: string;
}

const OUTLINE = '#3b2418';
const FILL = '#f7f3ec';

export const EMOTES: Readonly<Record<EmoteKind, EmoteDef>> = Object.freeze({
  heart: { kind: 'heart', icon: '#ff6fa8', outline: OUTLINE, fill: FILL }, // 小涵的標誌色
  surprise: { kind: 'surprise', icon: '#ac6c45', outline: OUTLINE, fill: FILL },
  question: { kind: 'question', icon: '#4aa3ff', outline: OUTLINE, fill: FILL }, // 毛毛的標誌色
  sweat: { kind: 'sweat', icon: '#4aa3ff', outline: OUTLINE, fill: FILL },
  note: { kind: 'note', icon: '#4c241b', outline: OUTLINE, fill: FILL },
  sleepy: { kind: 'sleepy', icon: '#2c3345', outline: OUTLINE, fill: FILL },
});

/** 表情出現在誰頭上：玩家，或某位居民（用居民 id）。 */
export type EmoteTarget = 'player' | { npc: string };

export interface EmoteRequest {
  who: EmoteTarget;
  kind: EmoteKind;
}

/** 這個事件要讓誰顯示什麼表情；不需要反應的事件回傳空陣列。 */
export function emotesForEvent(event: GameEvent): EmoteRequest[] {
  switch (event.type) {
    case 'talked': {
      const who = { npc: event.npcId };
      if (event.gifted) return [{ who, kind: 'heart' }];
      return [{ who, kind: event.first ? 'surprise' : 'note' }];
    }
    case 'refused':
      return [{ who: 'player', kind: refusalEmote(event.reason) }];
    case 'slept':
      return [{ who: 'player', kind: 'sleepy' }];
    case 'acted':
      return event.action === 'harvest' ? [{ who: 'player', kind: 'note' }] : [];
    default:
      return [];
  }
}

function refusalEmote(reason: string): EmoteKind {
  if (reason === 'NOT_ENOUGH_ENERGY') return 'sweat';
  if (reason === 'BAG_FULL') return 'surprise';
  return 'question';
}
