import type { SettingsService } from '../application/settings';
import { ACTION_IDS, assignKey, bindableKeyProblem, keyLabel, normalizeKey, resetBindings, type ActionId, type Bindings } from '../domain/keybindings';
import { CONTROLS_PLACEMENTS, CONTROL_STYLES, FONT_SIZES, HANDEDNESSES, TOUCH_MODES, type ControlStyle, type ControlsPlacement, type FontSize, type Handedness, type Settings, type TouchMode } from '../domain/settings';
import { FONT_SIZE_LABELS } from './accessibility';
import { prefersReducedMotion } from './motion';
import { PanelDialog } from './panel-dialog';

/** 設定面板裡每個動作的名稱（給玩家看；按鍵本身由 domain 的表決定）。文字來自 content/controls.json。 */
export type SettingsLabels = Readonly<Record<ActionId, string>>;

const SAVE_FAILED = '（這個瀏覽器無法儲存設定，本次的設定只在這個頁面有效。）';

const TOUCH_LABELS: Record<TouchMode, string> = {
  auto: '自動（觸控裝置顯示）',
  on: '一律顯示',
  off: '隱藏',
};
const PLACEMENT_LABELS: Record<ControlsPlacement, string> = { external: '畫面外（不遮住遊戲）', overlay: '覆蓋於畫面邊緣' };
const CONTROL_STYLE_LABELS: Record<ControlStyle, string> = {
  dpad: '方向鍵',
  'fixed-joystick': '固定搖桿',
  'floating-joystick': '浮動搖桿',
};
const HANDEDNESS_LABELS: Record<Handedness, string> = { right: '右手動作', left: '左手動作' };

/**
 * 設定面板（DOM）：改按鍵、字級、色盲模式、閃光與震動、觸控按鍵。
 * 改鍵流程：點「改鍵」→ 按下新按鍵即可；Esc 取消；已被別的動作用掉時，詢問是否交換；Esc 不能被指派。
 * 按鍵的按下本身由 MapScene 的 handleKey 轉交過來（captureKey），面板不自己監聽鍵盤。
 */
export class SettingsPanel {
  private readonly root: HTMLElement;
  private readonly keyList: HTMLElement;
  private readonly message: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly promptText: HTMLElement;
  private readonly fontChoices: HTMLElement;
  private readonly colorblind: HTMLInputElement;
  private readonly shake: HTMLInputElement;
  private readonly flash: HTMLInputElement;
  private readonly particles: HTMLInputElement;
  private readonly reduced: HTMLElement;
  private readonly touch: HTMLSelectElement;
  private readonly placement: HTMLSelectElement;
  private readonly controlStyle: HTMLSelectElement;
  private readonly handedness: HTMLSelectElement;
  private readonly continuousActions: HTMLInputElement;
  private readonly dialog: PanelDialog;
  private capturing: ActionId | null = null;
  private pendingSwap: { action: ActionId; key: string; conflict: ActionId } | null = null;

  constructor(
    private readonly doc: Document,
    private readonly service: SettingsService,
    /** 每個動作在面板上的名稱（改鍵列表、提示與交換訊息都用這份）。 */
    private readonly labels: SettingsLabels,
  ) {
    this.root = required(doc, '#settings-panel');
    this.dialog = new PanelDialog(this.root);
    this.keyList = required(doc, '#settings-keys');
    this.message = required(doc, '#settings-message');
    this.prompt = required(doc, '#settings-prompt');
    this.promptText = required(doc, '#settings-prompt-text');
    this.fontChoices = required(doc, '#settings-font');
    this.colorblind = required<HTMLInputElement>(doc, '#settings-colorblind');
    this.shake = required<HTMLInputElement>(doc, '#settings-shake');
    this.flash = required<HTMLInputElement>(doc, '#settings-flash');
    this.particles = required<HTMLInputElement>(doc, '#settings-particles');
    this.reduced = required(doc, '#settings-reduced');
    this.touch = required<HTMLSelectElement>(doc, '#settings-touch');
    this.placement = required<HTMLSelectElement>(doc, '#settings-placement');
    this.controlStyle = required<HTMLSelectElement>(doc, '#settings-control-style');
    this.handedness = required<HTMLSelectElement>(doc, '#settings-handedness');
    this.continuousActions = required<HTMLInputElement>(doc, '#settings-continuous-actions');

    required(doc, '#settings-close').addEventListener('click', () => this.close());
    required(doc, '#settings-reset').addEventListener('click', () => this.restoreDefaults());
    required(doc, '#settings-swap').addEventListener('click', () => this.swap());
    required(doc, '#settings-cancel-swap').addEventListener('click', () => this.cancelSwap());
    this.keyList.addEventListener('click', (event) => {
      const target = event.target as Element | null;
      const button = target?.closest<HTMLButtonElement>('button[data-action]');
      if (button?.dataset.action) this.startCapture(button.dataset.action as ActionId);
    });
    this.fontChoices.addEventListener('click', (event) => {
      const target = event.target as Element | null;
      const button = target?.closest<HTMLButtonElement>('button[data-font]');
      if (button?.dataset.font) this.setFont(button.dataset.font as FontSize);
    });
    this.colorblind.addEventListener('change', () => this.save({ colorblind: this.colorblind.checked }, '已更新色盲模式。'));
    this.shake.addEventListener('change', () => this.setEffect('shake', this.shake.checked));
    this.flash.addEventListener('change', () => this.setEffect('flash', this.flash.checked));
    this.particles.addEventListener('change', () => this.setEffect('particles', this.particles.checked));
    this.touch.addEventListener('change', () => this.save({ touchControls: this.touch.value as TouchMode }, '已更新虛擬按鍵的設定。'));
    this.placement.addEventListener('change', () => {
      const saved = this.service.update({ mobile: { controlsPlacement: this.placement.value as ControlsPlacement } });
      this.say(saved ? '已更新觸控按鍵版位。' : `已更新觸控按鍵版位。${SAVE_FAILED}`);
      this.render();
    });
    this.controlStyle.addEventListener('change', () => {
      const saved = this.service.update({ mobile: { controlStyle: this.controlStyle.value as ControlStyle } });
      this.say(saved ? '已更新移動控制方式。' : `已更新移動控制方式。${SAVE_FAILED}`);
      this.render();
    });
    this.handedness.addEventListener('change', () => {
      const saved = this.service.update({ mobile: { handedness: this.handedness.value as Handedness } });
      this.say(saved ? '已更新慣用手。' : `已更新慣用手。${SAVE_FAILED}`);
      this.render();
    });
    this.continuousActions.addEventListener('change', () => {
      const saved = this.service.update({ mobile: { continuousActions: this.continuousActions.checked } });
      this.say(saved ? '已更新長按連續農務設定。' : `已更新長按連續農務設定。${SAVE_FAILED}`);
      this.render();
    });

    this.buildFontChoices();
    this.buildTouchOptions();
    this.buildPlacementOptions();
    this.buildControlStyleOptions();
    this.buildHandednessOptions();
    this.render();
  }

  isOpen(): boolean {
    return this.dialog.isOpen();
  }

  open(): void {
    this.render();
    this.dialog.open();
  }

  close(): void {
    this.capturing = null;
    this.pendingSwap = null;
    this.dialog.close();
  }

  isCapturing(): boolean {
    return this.capturing !== null;
  }

  /**
   * 改鍵時收到的按鍵（已由 handleKey 攔下，不會觸發遊戲動作）。
   * 修飾鍵單獨按下時忽略，等真正的按鍵；Esc 取消；其餘依 domain 的規則指派。
   */
  captureKey(rawKey: string): void {
    const action = this.capturing;
    if (!action) return;
    const key = normalizeKey(rawKey);
    if (key === 'Escape') {
      this.capturing = null;
      this.say('已取消改鍵。');
      this.render();
      return;
    }
    const problem = bindableKeyProblem(key);
    if (problem === 'UNBINDABLE') return;
    if (problem === 'RESERVED') {
      this.capturing = null;
      this.say('Esc 保留給關閉面板，不能指派給任何動作。');
      this.render();
      return;
    }
    const result = assignKey(this.service.get().bindings, action, key);
    this.capturing = null;
    if (!result.ok) {
      if (result.reason === 'CONFLICT') {
        this.pendingSwap = { action, key, conflict: result.conflict };
        this.say(`「${keyLabel(key)}」目前是「${this.labels[result.conflict]}」的按鍵。要交換兩者的按鍵嗎？`);
      }
      this.render();
      return;
    }
    this.commitBindings(result.bindings, `已將「${this.labels[action]}」改成 ${keyLabel(key)}。`);
  }

  private startCapture(action: ActionId): void {
    this.pendingSwap = null;
    this.capturing = action;
    this.say(`請按下「${this.labels[action]}」的新按鍵（Esc 取消）。`);
    this.render();
  }

  private swap(): void {
    const pending = this.pendingSwap;
    if (!pending) return;
    this.pendingSwap = null;
    const result = assignKey(this.service.get().bindings, pending.action, pending.key, { swap: true });
    if (!result.ok) {
      this.say('無法交換這兩個按鍵。');
      this.render();
      this.focusRow(pending.action);
      return;
    }
    this.commitBindings(
      result.bindings,
      `已交換「${this.labels[pending.action]}」與「${this.labels[pending.conflict]}」的按鍵。`,
    );
    this.focusRow(pending.action);
  }

  private cancelSwap(): void {
    const pending = this.pendingSwap;
    this.pendingSwap = null;
    this.say('已取消，按鍵維持原來的設定。');
    this.render();
    if (pending) this.focusRow(pending.action);
  }

  /** 交換提示的按鈕隱藏後，焦點回到原本要改鍵的那一列的「改鍵」按鈕。 */
  private focusRow(action: ActionId): void {
    const button = Array.from(this.keyList.querySelectorAll<HTMLButtonElement>('button[data-action]')).find(
      (item) => item.dataset.action === action,
    );
    button?.focus();
  }

  private restoreDefaults(): void {
    this.capturing = null;
    this.pendingSwap = null;
    this.commitBindings(resetBindings(), '已恢復預設按鍵。');
  }

  private setFont(size: FontSize): void {
    this.save({ fontSize: size }, `字級已改為「${FONT_SIZE_LABELS[size]}」。`);
  }

  private setEffect(name: 'shake' | 'flash' | 'particles', on: boolean): void {
    const effects = { ...this.service.get().effects, [name]: on };
    this.save({ effects }, '已更新閃光與震動的設定。');
  }

  private commitBindings(bindings: Bindings, text: string): void {
    this.save({ bindings }, text);
  }

  private save(patch: Partial<Settings>, text: string): void {
    const saved = this.service.update(patch);
    this.say(saved ? text : `${text}${SAVE_FAILED}`);
    this.render();
  }

  private say(text: string): void {
    this.message.textContent = text;
  }

  private buildFontChoices(): void {
    for (const size of FONT_SIZES) {
      const button = this.doc.createElement('button');
      button.type = 'button';
      button.dataset.font = size;
      button.textContent = FONT_SIZE_LABELS[size];
      this.fontChoices.append(button);
    }
  }

  private buildTouchOptions(): void {
    for (const mode of TOUCH_MODES) {
      const option = this.doc.createElement('option');
      option.value = mode;
      option.textContent = TOUCH_LABELS[mode];
      this.touch.append(option);
    }
  }

  private buildPlacementOptions(): void {
    for (const placement of CONTROLS_PLACEMENTS) {
      const option = this.doc.createElement('option');
      option.value = placement;
      option.textContent = PLACEMENT_LABELS[placement];
      this.placement.append(option);
    }
  }

  private buildControlStyleOptions(): void {
    for (const style of CONTROL_STYLES) {
      const option = this.doc.createElement('option');
      option.value = style;
      option.textContent = CONTROL_STYLE_LABELS[style];
      this.controlStyle.append(option);
    }
  }

  private buildHandednessOptions(): void {
    for (const handedness of HANDEDNESSES) {
      const option = this.doc.createElement('option');
      option.value = handedness;
      option.textContent = HANDEDNESS_LABELS[handedness];
      this.handedness.append(option);
    }
  }

  /**
   * 依目前的偏好重畫整個面板（按鍵列表、字級按鈕、勾選框與交換提示）。
   * 經過 dialog.redraw：重畫前記下焦點，按鍵列表重建後焦點回到同一個動作的「改鍵」按鈕（data-focus-key）。
   */
  private render(): void {
    this.dialog.redraw(() => this.paint());
  }

  private paint(): void {
    const settings = this.service.get();
    this.keyList.replaceChildren(...ACTION_IDS.map((action) => this.keyRow(action, settings.bindings[action])));
    this.prompt.hidden = this.pendingSwap === null;
    if (this.pendingSwap) this.promptText.textContent = `「${keyLabel(this.pendingSwap.key)}」與「${this.labels[this.pendingSwap.conflict]}」交換`;
    for (const button of this.fontChoices.querySelectorAll<HTMLButtonElement>('button[data-font]')) {
      button.setAttribute('aria-pressed', String(button.dataset.font === settings.fontSize));
    }
    this.colorblind.checked = settings.colorblind;
    this.shake.checked = settings.effects.shake;
    this.flash.checked = settings.effects.flash;
    this.particles.checked = settings.effects.particles;
    this.touch.value = settings.touchControls;
    this.placement.value = settings.mobile.controlsPlacement;
    this.controlStyle.value = settings.mobile.controlStyle;
    this.handedness.value = settings.mobile.handedness;
    this.continuousActions.checked = settings.mobile.continuousActions;
    this.reduced.textContent = prefersReducedMotion()
      ? '系統的「減少動態」已開啟，閃光、震動與粒子效果會一律關閉。'
      : '這些效果在系統開啟「減少動態」時會一律關閉。';
  }

  private keyRow(action: ActionId, key: string): HTMLElement {
    const item = this.doc.createElement('li');
    const name = this.doc.createElement('span');
    name.textContent = this.labels[action];
    // 列文字可由程式聚焦（不進 Tab 順序）；與「改鍵」按鈕共用同一個焦點鍵，重畫後焦點能回到同一列。
    name.tabIndex = -1;
    name.dataset.focusKey = action;
    const current = this.doc.createElement('kbd');
    current.textContent = keyLabel(key);
    const button = this.doc.createElement('button');
    button.type = 'button';
    button.dataset.action = action;
    button.dataset.focusKey = action;
    const capturingThis = this.capturing === action;
    button.textContent = capturingThis ? '按下新按鍵…' : '改鍵';
    button.setAttribute('aria-label', `改鍵：${this.labels[action]}，目前是 ${keyLabel(key)}`);
    item.append(name, current, button);
    return item;
  }
}

function required<T extends Element = HTMLElement>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`頁面缺少必要元素 ${selector}`);
  return found;
}
