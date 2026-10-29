import type { ContentPack } from '../domain/content';
import { dateLabel, formatClock } from '../domain/calendar';
import type { GameState } from '../domain/game-state';
import { TOOL_NAMES, type ToolId } from '../domain/tools';
import { levelOf, SKILL_IDS, SKILL_NAMES } from '../domain/skills';
import { WEATHER_NAMES } from '../domain/weather';
import { pendingTalentSkills } from './skill-panel';
import { farmRating } from '../application/rating';
import { NO_RATING } from '../domain/rating';
import { mineStatusLabel } from './mine-status';
import { levelMarker } from './accessibility';

const LOG_LIMIT = 6;
const TOAST_DURATION_MS = 4_000;

export interface HeldPointerStart {
  pointerId: number;
  clientX: number;
  clientY: number;
}

/** DOM 版 HUD：只負責把狀態呈現到頁面上，不含任何規則。 */
export class Hud {
  private readonly doc: Document;
  private colorblind = false;
  private readonly clock: HTMLElement;
  private readonly day: HTMLElement;
  private readonly weather: HTMLElement;
  private readonly skills: HTMLElement;
  private readonly gold: HTMLElement;
  private readonly rating: HTMLElement;
  private readonly energyFill: HTMLElement;
  private readonly energyText: HTMLElement;
  private readonly tool: HTMLElement;
  private readonly seed: HTMLElement;
  private readonly mine: HTMLElement;
  private readonly version: HTMLElement;
  private readonly log: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly logToggle: HTMLButtonElement;
  private readonly logCount: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly mainAction: HTMLButtonElement;
  private toastTimer: number | null = null;

  constructor(doc: Document) {
    this.doc = doc;
    this.clock = required(doc, '#hud-clock');
    this.day = required(doc, '#hud-day');
    this.weather = required(doc, '#hud-weather');
    this.skills = required(doc, '#hud-skills');
    this.gold = required(doc, '#hud-gold');
    this.rating = required(doc, '#hud-rating');
    this.energyFill = required(doc, '#hud-energy-fill');
    this.energyText = required(doc, '#hud-energy-text');
    this.tool = required(doc, '#hud-tool');
    this.seed = required(doc, '#hud-seed');
    this.mine = required(doc, '#hud-mine');
    this.version = required(doc, '#hud-version');
    this.log = required(doc, '#hud-log');
    this.toast = required(doc, '#hud-toast');
    this.logToggle = required<HTMLButtonElement>(doc, '#hud-log-toggle');
    this.logCount = required(doc, '#hud-log-count');
    this.log.tabIndex = 0;
    // Keep browser scrolling and Tab navigation while preventing game shortcuts.
    this.log.addEventListener('keydown', (event) => event.stopPropagation());
    this.logToggle.addEventListener('click', () => {
      const expanded = this.logToggle.getAttribute('aria-expanded') === 'true';
      this.setLogExpanded(!expanded);
    });
    this.hint = required(doc, '#hud-hint');
    this.mainAction = required(doc, '#hud-action');
  }

  /** 底部的操作提示（由 controls-hint.ts 依目前的按鍵產生）。 */
  setControlsHint(text: string): void {
    this.hint.textContent = text;
  }

  /** 狀態列上的版本號（例如 v0.1.0）；點了說明頁可看到完整的更新日誌。 */
  setVersion(version: string): void {
    this.version.textContent = `v${version}`;
  }

  update(state: GameState, pack: ContentPack): void {
    this.clock.textContent = formatClock(state.calendar);
    this.day.textContent = dateLabel(state.calendar);
    this.weather.textContent = `${WEATHER_NAMES[state.weather]}　明天：${WEATHER_NAMES[state.forecast]}`;
    this.gold.textContent = `${state.gold} 金`;
    const grade = farmRating(state, {
      rating: pack.rating ?? NO_RATING,
      dexCategories: pack.collection ?? [],
      npcIds: pack.npcs.map((n) => n.id),
      friendship: pack.friendship,
    });
    this.rating.textContent = `評級 ${grade.grade}`;
    const pending = pendingTalentSkills(state, pack.tuning.skills.thresholds, pack.talents).length;
    const levels = SKILL_IDS.map((id) => `${SKILL_NAMES[id]} ${levelOf(state.skills[id], pack.tuning.skills.thresholds)}`).join('　');
    this.skills.textContent = pending > 0 ? `${levels}　（有 ${pending} 項可選天賦）` : levels;
    const ratio = Math.max(0, Math.min(1, state.energy.current / (state.energy.max || 1)));
    this.energyFill.style.width = `${Math.round(ratio * 100)}%`;
    this.energyText.textContent = `${state.energy.current} / ${state.energy.max}`;
    this.tool.textContent = TOOL_NAMES[state.tool];
    const crop = pack.crops.find((c) => c.id === state.selectedSeed);
    this.seed.textContent = `種子：${crop?.name ?? state.selectedSeed}`;
    this.mine.textContent = mineStatusLabel(state);
  }

  /** 點技能列就打開技能與天賦面板（鍵盤的 K 也一樣）。 */
  bindSkills(onOpen: () => void): void {
    this.skills.addEventListener('click', onOpen);
  }

  /** 狀態列的「說明」與「存檔」按鈕（鍵盤的 ? 與 L 也一樣）。 */
  bindDialogs(onHelp: () => void, onSaves: () => void): void {
    required(this.doc, '#hud-help').addEventListener('click', onHelp);
    required(this.doc, '#hud-saves').addEventListener('click', onSaves);
  }

  /** 有新版本可用時顯示更新按鈕；按下後才套用（先存檔，見 service-worker.ts），不會自動打斷遊戲。 */
  showUpdate(onApply: () => void): void {
    const button = required<HTMLButtonElement>(this.doc, '#hud-update');
    button.hidden = false;
    button.addEventListener('click', onApply, { once: true });
  }

  /** 狀態列的「設定」按鈕（鍵盤的 O 也一樣）。 */
  bindSettings(onOpen: () => void): void {
    required(this.doc, '#hud-settings').addEventListener('click', onOpen);
  }

  /** Compact HUD action label is supplied by the current InteractionDescriptor; this button only emits the existing action. */
  bindMainAction(onAction: () => void): void {
    this.mainAction.addEventListener('click', onAction);
  }

  /** Long press is opt-in at the scene; this adapter only reports pointer lifecycle. */
  bindMainActionHold(onStart: () => boolean, onEnd: () => void): () => void {
    let timer: number | null = null;
    let heldPointer: number | null = null;
    const suppressedClicks = new Map<number, number>();
    const suppressClickFor = (pointerId: number, expiresAt = Number.POSITIVE_INFINITY): void => {
      suppressedClicks.set(pointerId, expiresAt);
    };
    const pruneSuppressedClicks = (): void => {
      const now = Date.now();
      for (const [pointerId, expiresAt] of suppressedClicks) {
        if (expiresAt < now) suppressedClicks.delete(pointerId);
      }
    };
    const clear = (): void => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const end = (event: PointerEvent): void => {
      if (heldPointer !== event.pointerId) {
        if (event.type === 'pointerup' && suppressedClicks.has(event.pointerId)) {
          suppressedClicks.set(event.pointerId, Date.now() + 1000);
        } else if (event.type === 'pointercancel') {
          suppressedClicks.delete(event.pointerId);
        }
        return;
      }
      clear();
      if (suppressedClicks.has(event.pointerId)) suppressedClicks.set(event.pointerId, Date.now() + 1000);
      heldPointer = null;
      onEnd();
      try {
        if (this.mainAction.hasPointerCapture(event.pointerId)) this.mainAction.releasePointerCapture(event.pointerId);
      } catch { /* The browser may already have released it. */ }
    };
    const cancel = (): void => {
      clear();
      if (heldPointer === null) return;
      if (suppressedClicks.has(heldPointer)) suppressedClicks.set(heldPointer, Date.now() + 1000);
      else suppressClickFor(heldPointer, Date.now() + 1000);
      heldPointer = null;
      onEnd();
    };
    const leave = (event: PointerEvent): void => {
      if (heldPointer !== event.pointerId) return;
      const rect = this.mainAction.getBoundingClientRect();
      if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) return;
      cancel();
    };
    const onDown = (event: PointerEvent): void => {
      if (this.mainAction.disabled || (event.button !== 0 && event.pointerType !== 'touch')) return;
      pruneSuppressedClicks();
      // A continuous action is one owned gesture; extra fingers must not replace its timer or owner.
      if (heldPointer !== null) {
        if (event.pointerId !== heldPointer) suppressClickFor(event.pointerId);
        return;
      }
      // A cancelled gesture cannot emit its pending click; allow the browser's reused ID to start fresh.
      suppressedClicks.delete(event.pointerId);
      heldPointer = event.pointerId;
      try { this.mainAction.setPointerCapture(event.pointerId); } catch { /* Synthetic or detached target. */ }
      timer = window.setTimeout(() => {
        timer = null;
        const owner = heldPointer;
        if (owner !== null && onStart()) suppressClickFor(owner);
      }, 280);
    };
    const onClick = (event: MouseEvent): void => {
      pruneSuppressedClicks();
      const pointerId = 'pointerId' in event ? (event as PointerEvent).pointerId : undefined;
      if (pointerId === undefined || !suppressedClicks.has(pointerId)) return;
      suppressedClicks.delete(pointerId);
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const onContextMenu = (event: MouseEvent): void => event.preventDefault();
    const onVisibilityChange = (): void => {
      if (this.doc.visibilityState === 'hidden') cancel();
    };
    this.mainAction.addEventListener('pointerdown', onDown);
    this.mainAction.addEventListener('pointerup', end);
    this.mainAction.addEventListener('pointercancel', end);
    this.mainAction.addEventListener('lostpointercapture', end);
    this.mainAction.addEventListener('pointermove', leave);
    this.mainAction.addEventListener('pointerleave', leave);
    this.mainAction.addEventListener('click', onClick, true);
    this.mainAction.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', cancel);
    window.addEventListener('pagehide', cancel);
    this.doc.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancel();
      this.mainAction.removeEventListener('pointerdown', onDown);
      this.mainAction.removeEventListener('pointerup', end);
      this.mainAction.removeEventListener('pointercancel', end);
      this.mainAction.removeEventListener('lostpointercapture', end);
      this.mainAction.removeEventListener('pointermove', leave);
      this.mainAction.removeEventListener('pointerleave', leave);
      this.mainAction.removeEventListener('click', onClick, true);
      this.mainAction.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('pagehide', cancel);
      this.doc.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }

  setMainAction(label: string, enabled: boolean): void {
    this.mainAction.textContent = label;
    this.mainAction.setAttribute('aria-label', `主要動作：${label}`);
    this.mainAction.disabled = !enabled;
  }

  /** 狀態列工具／種子捷徑：短按清單，長按輪盤。 */
  bindToolSeedSelectors(
    onTool: (wheel: boolean, pointer?: HeldPointerStart) => void,
    onSeed: (wheel: boolean, pointer?: HeldPointerStart) => void,
    onCancel: () => void,
  ): void {
    this.bindHoldSelector(required(this.doc, '#hud-tool'), onTool, onCancel);
    this.bindHoldSelector(required(this.doc, '#hud-seed'), onSeed, onCancel);
  }

  private bindHoldSelector(element: HTMLElement, onOpen: (wheel: boolean, pointer?: HeldPointerStart) => void, onCancel: () => void): void {
    let timer: number | null = null;
    let holdOpenedAt = 0;
    let pointerStart: HeldPointerStart | null = null;
    const clear = (): void => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    element.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 && event.pointerType !== 'touch') return;
      clear();
      pointerStart = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
      timer = window.setTimeout(() => {
        holdOpenedAt = Date.now();
        onOpen(true, pointerStart ?? undefined);
      }, 280);
    });
    element.addEventListener('pointerup', () => {
      clear();
      pointerStart = null;
    });
    element.addEventListener('pointercancel', () => {
      clear();
      pointerStart = null;
      holdOpenedAt = 0;
      onCancel();
    });
    element.addEventListener('pointerleave', clear);
    element.addEventListener('click', (event) => {
      if (holdOpenedAt > 0 && Date.now() - holdOpenedAt < 1000) {
        holdOpenedAt = 0;
        event.preventDefault();
        return;
      }
      onOpen(false);
    });
    element.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  /** 色盲模式：訊息前面加上 ✕ 或 ✓ 的文字標記（見 accessibility.ts）。 */
  setColorblind(on: boolean): void {
    this.colorblind = on;
  }

  messages(lines: readonly string[]): void {
    for (const line of lines) this.append(line, 'info');
  }

  error(message: string): void {
    this.append(message, 'error');
  }

  private append(text: string, level: 'info' | 'error'): void {
    const following = this.log.scrollHeight - this.log.clientHeight - this.log.scrollTop <= 1;
    const oldestWillBeRemoved = this.log.children.length >= LOG_LIMIT;
    const logTop = this.log.getBoundingClientRect().top;
    const anchor = Array.from(this.log.children).find((child, index) =>
      (!oldestWillBeRemoved || index > 0) && child.getBoundingClientRect().bottom > logTop,
    );
    const anchorTop = anchor?.getBoundingClientRect().top;
    const item = this.doc.createElement('li');
    item.textContent = levelMarker(level, this.colorblind) + text;
    item.className = level;
    this.log.append(item);
    while (this.log.children.length > LOG_LIMIT) this.log.firstElementChild?.remove();
    if (following) this.log.scrollTop = this.log.scrollHeight;
    else if (anchor && anchorTop !== undefined) this.log.scrollTop += anchor.getBoundingClientRect().top - anchorTop;
    this.updateLogCount();
    this.showToast(item.textContent ?? text);
  }

  private updateLogCount(): void {
    this.logCount.textContent = String(this.log.children.length);
    const expanded = this.logToggle.getAttribute('aria-expanded') === 'true';
    this.logToggle.setAttribute('aria-label', `${expanded ? '收合' : '展開'}最近 ${this.log.children.length} 則訊息`);
  }

  private setLogExpanded(expanded: boolean): void {
    this.logToggle.setAttribute('aria-expanded', String(expanded));
    this.log.hidden = !expanded;
    this.logToggle.setAttribute('aria-label', `${expanded ? '收合' : '展開'}最近 ${this.log.children.length} 則訊息`);
    if (expanded) this.log.scrollTop = this.log.scrollHeight;
  }

  private showToast(text: string): void {
    const view = this.doc.defaultView;
    if (!view) return;
    if (this.toastTimer !== null) view.clearTimeout(this.toastTimer);
    this.toast.textContent = text;
    this.toast.hidden = false;
    this.toastTimer = view.setTimeout(() => {
      this.toast.hidden = true;
      this.toastTimer = null;
    }, TOAST_DURATION_MS);
  }
}

function required<T extends Element = HTMLElement>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`頁面缺少必要元素 ${selector}`);
  return found;
}
