import type { ActionFeedback } from '../../application/game-commands';

/**
 * 程式會播放的音效 id（必須都在 content/sounds.json 裡，由 sound-catalog.spec.ts 檢查）。
 * 地形腳步的音效 id 寫在 content/terrain.json，同樣由載入時檢查。
 */
export const SOUND_IDS = [
  'click',
  'swing',
  'till',
  'water',
  'plant',
  'harvest',
  'ship',
  'sleep',
  'talk',
  'gift',
  'refuse',
  'save',
  'step.soft',
  'step.dirt',
  'step.stone',
  'chop',
  'forage',
  'mine',
  'cast',
] as const;

/** 農務動作命中（工具落下、種子飛出、收成）時播放的音效。 */
export const ACTION_SOUND: Record<ActionFeedback, (typeof SOUND_IDS)[number]> = {
  till: 'till',
  water: 'water',
  plant: 'plant',
  harvest: 'harvest',
  ship: 'ship',
  chop: 'chop',
  forage: 'forage',
  mine: 'mine',
  fish: 'cast',
};
