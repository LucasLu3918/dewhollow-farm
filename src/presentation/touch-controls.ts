import type { ActionId } from '../domain/keybindings';
import { TOUCH_REPEAT_MS, buildTouchButtons, type TouchButton, type TouchLabels, type TouchText } from './touch-pad';

/**
 * 虛擬按鍵（DOM，pointer events）：畫面下方的方向鍵與常用動作鍵，另有一顆「更多」收起次要選單與工具。
 * 按下只回報「動作」，由 MapScene 轉成該動作目前綁定的按鍵，走鍵盤的同一條路徑。
 * 方向鍵按住會連續移動（每 TOUCH_REPEAT_MS 一次）。顯示與否由 apply-settings.ts 決定（#touch-controls 的 hidden）。
 * 「更多」展開時，選了一個動作就自動收起，避免選單或面板蓋住後面要操作的畫面。
 */
export class TouchControls {
  private timer: number | null = null;
  private readonly moreToggle: HTMLButtonElement;
  private readonly morePanel: HTMLElement;

  /** labels：每個按鈕的文字（來自 content/controls.json）；more：「更多」鍵的文字。 */
  constructor(doc: Document, onPress: (action: ActionId) => void, labels: TouchLabels, more: TouchText) {
    const root = doc.querySelector<HTMLElement>('#touch-controls');
    if (!root) throw new Error('頁面缺少必要元素 #touch-controls');
    root.replaceChildren();
    const buttons = buildTouchButtons(labels);

    const common = doc.createElement('div');
    common.className = 'touch-common';
    common.append(this.group(doc, 'move', buttons, onPress));
    this.moreToggle = this.toggleButton(doc, more);
    const act = this.group(doc, 'act', buttons, onPress);
    act.append(this.moreToggle);
    common.append(act);
    root.append(common);

    const pick = (action: ActionId): void => {
      this.setMoreOpen(false);
      onPress(action);
    };
    this.morePanel = doc.createElement('div');
    this.morePanel.id = 'touch-more';
    this.morePanel.className = 'touch-more';
    this.morePanel.hidden = true;
    this.morePanel.append(this.group(doc, 'menu', buttons, pick), this.group(doc, 'tool', buttons, pick));
    root.append(this.morePanel);
    this.moreToggle.setAttribute('aria-controls', this.morePanel.id);
  }

  private group(doc: Document, group: TouchButton['group'], buttons: TouchButton[], onPress: (action: ActionId) => void): HTMLElement {
    const wrap = doc.createElement('div');
    wrap.className = `touch-group touch-${group}`;
    for (const entry of buttons.filter((b) => b.group === group)) {
      wrap.append(this.button(doc, entry, onPress));
    }
    return wrap;
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

  private toggleButton(doc: Document, text: TouchText): HTMLButtonElement {
    const el = doc.createElement('button');
    el.type = 'button';
    el.className = 'touch-button touch-act-button touch-more-toggle';
    el.textContent = text.label;
    el.setAttribute('aria-label', text.name);
    el.setAttribute('aria-expanded', 'false');
    el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.setMoreOpen(this.morePanel.hidden);
    });
    el.addEventListener('contextmenu', (event) => event.preventDefault());
    return el;
  }

  private setMoreOpen(open: boolean): void {
    this.morePanel.hidden = !open;
    this.moreToggle.setAttribute('aria-expanded', String(open));
    this.moreToggle.classList.toggle('is-open', open);
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
