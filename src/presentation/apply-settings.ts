import type { Settings } from '../domain/settings';
import { fontScaleOf } from './accessibility';
import { touchVisible } from './touch-pad';

/** 裝置的主要指標是不是觸控（粗指標）。讀取失敗時當作不是觸控。 */
export function isCoarsePointer(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/**
 * 把偏好套用到頁面：字級（CSS 變數 --font-scale）、色盲模式（data-colorblind，樣式與訊息標記用）、
 * 虛擬按鍵的顯示（#touch-controls 的 hidden）。只碰呈現，不改遊戲狀態。
 */
export function applySettings(doc: Document, settings: Settings, coarse: boolean): void {
  const root = doc.documentElement;
  root.style.setProperty('--font-scale', String(fontScaleOf(settings.fontSize)));
  root.dataset.colorblind = settings.colorblind ? 'on' : 'off';
  const pad = doc.querySelector<HTMLElement>('#touch-controls');
  if (pad) pad.hidden = !touchVisible(settings.touchControls, coarse);
}
