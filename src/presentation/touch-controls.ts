import type { ActionId } from '../domain/keybindings';
import { TOUCH_REPEAT_MS, buildTouchButtons, type TouchButton, type TouchLabels } from './touch-pad';

/**
 * 虛擬按鍵（DOM，pointer events）：畫面下方的方向鍵與動作鍵。
 * 按下只回報「動作」，由 MapScene 轉成該動作目前綁定的按鍵，走鍵盤的同一條路徑。
 * 方向鍵按住會連續移動（每 TOUCH_REPEAT_MS 一次）。顯示與否由 apply-settings.ts 決定（#touch-controls 的 hidden）。
 */
export class TouchControls {
  private timer: number | null = null;

  /** labels：每個按鈕的文字（來自 content/controls.json）。 */
  constructor(doc: Document, onPress: (action: ActionId) => void, labels: TouchLabels) {
    const root = doc.querySelector<HTMLElement>('#touch-controls');
    if (!root) throw new Error('頁面缺少必要元素 #touch-controls');
    root.replaceChildren();
    const buttons = buildTouchButtons(labels);
    for (const group of ['move', 'act', 'tool'] as const) {
      const wrap = doc.createElement('div');
      wrap.className = `touch-group touch-${group}`;
      for (const entry of buttons.filter((b) => b.group === group)) {
        wrap.append(this.button(doc, entry, onPress));
      }
      root.append(wrap);
    }
  }

  private button(doc: Document, entry: TouchButton, onPress: (action: ActionId) => void): HTMLButtonElement {
    const el = doc.createElement('button');
    el.type = 'button';
    el.className = `touch-button touch-${entry.group}-button`;
    el.dataset.action = entry.action;
    el.textContent = entry.label;
    el.setAttribute('aria-label', entry.name);
    el.addEventListener('pointerdown', (event) => {
      // 不要讓觸控變成捲動、文字選取或長按選單。
      event.preventDefault();
      onPress(entry.action);
      if (entry.group === 'move') this.startRepeat(() => onPress(entry.action));
    });
    const stop = (): void => this.stopRepeat();
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    el.addEventListener('pointerleave', stop);
    el.addEventListener('lostpointercapture', stop);
    el.addEventListener('contextmenu', (event) => event.preventDefault());
    return el;
  }

  private startRepeat(step: () => void): void {
    this.stopRepeat();
    this.timer = window.setInterval(step, TOUCH_REPEAT_MS);
  }

  private stopRepeat(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
}
