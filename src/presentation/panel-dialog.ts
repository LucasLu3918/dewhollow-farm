/**
 * 面板開關的共用機制（DOM）：開啟時記下原本的焦點、把焦點移入面板；關閉時把焦點還原；
 * 開啟中的模態面板把 Tab 循環在面板內。循環與還原的決策是純函式（下方，node 測試覆蓋），這裡只做 DOM 操作。
 * 疊放：開著的模態面板依開啟順序放在堆疊裡，焦點陷阱以最後開啟的為準。
 */

/** MapScene 的按鍵閘門與 Esc 清單只需要這兩個方法。 */
export interface OpenablePanel {
  isOpen(): boolean;
  close(): void;
}

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

/**
 * Tab 循環的下一個索引。current 是目前焦點在可互動清單中的位置；焦點不在清單中（例如在標題上）時傳 -1。
 * 清單是空的時回傳 -1，由呼叫端決定要把焦點放到哪裡。
 */
export function nextFocusIndex(count: number, current: number, backwards: boolean): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return backwards ? count - 1 : 0;
  return backwards ? (current - 1 + count) % count : (current + 1) % count;
}

export type RestoreDecision = 'return' | 'top' | 'none';

/**
 * 關閉一個面板之後焦點該去哪裡。
 * - 還有其他模態面板開著：若焦點原本在被關的面板內，交給堆疊最上面的那個；否則不動。
 * - 沒有了：若記下的開啟元素還能用，還原到它；否則不動。
 */
export function restoreDecision(input: { modalsLeft: number; focusWasInside: boolean; returnTargetUsable: boolean }): RestoreDecision {
  if (input.modalsLeft > 0) return input.focusWasInside ? 'top' : 'none';
  return input.returnTargetUsable ? 'return' : 'none';
}

/** 重畫前記下的焦點位置：焦點元素的 data-focus-key（沒有就是 null），以及它在可互動清單中的位置（不在清單中是 -1）。 */
export interface FocusMemory {
  key: string | null;
  interactiveIndex: number;
}

/** 重畫後面板內的一個焦點候選（依文件順序）。disabled 的按鈕仍在清單中，但不會被選為還原目標。 */
export interface FocusSlot {
  key: string | null;
  disabled: boolean;
  /** 沒有 disabled、tabindex 不是負的：會進 Tab 循環的可互動元素。 */
  interactive: boolean;
}

export type FocusRestore = { kind: 'slot'; index: number } | { kind: 'title' } | { kind: 'none' };

/**
 * 內容重畫後，焦點該放到哪一個候選。順序：
 * (a) 同 data-focus-key 的可互動元素；若沒有，同 key 的非停用元素（例如同一列的文字）；
 * (b) 重畫前在可互動清單中的同一位置（超過清單長度時取最後一個）；
 * (c) 面板標題；都沒有就不動。disabled 的元素永遠不會被選。
 */
export function focusRestoreTarget(memory: FocusMemory | null, slots: readonly FocusSlot[], hasTitle: boolean): FocusRestore {
  if (memory === null) return { kind: 'none' };
  if (memory.key !== null) {
    const byKey = slots.findIndex((s) => s.key === memory.key && s.interactive);
    if (byKey >= 0) return { kind: 'slot', index: byKey };
    const text = slots.findIndex((s) => s.key === memory.key && !s.disabled);
    if (text >= 0) return { kind: 'slot', index: text };
  }
  if (memory.interactiveIndex >= 0) {
    const live = slots.flatMap((s, i) => (s.interactive ? [i] : []));
    const at = live[Math.min(memory.interactiveIndex, live.length - 1)];
    if (at !== undefined) return { kind: 'slot', index: at };
  }
  return hasTitle ? { kind: 'title' } : { kind: 'none' };
}

/** 開著的模態面板，最後開啟的在最後面。 */
const modalStack: PanelDialog[] = [];
const trappedDocuments = new WeakSet<Document>();

export class PanelDialog implements OpenablePanel {
  private open_ = false;
  private returnTarget: HTMLElement | null = null;
  private readonly title: HTMLElement | null;

  constructor(private readonly root: HTMLElement) {
    const doc = root.ownerDocument;
    const labelledBy = root.getAttribute('aria-labelledby');
    const title = (labelledBy ? doc.getElementById(labelledBy) : null) ?? root.querySelector<HTMLElement>('h2');
    // 沒有可互動元素時，焦點落在標題上；標題只接受程式聚焦，不進入 Tab 順序。
    if (title && !title.hasAttribute('tabindex')) title.tabIndex = -1;
    this.title = title;
    trapTabKey(doc);
  }

  isOpen(): boolean {
    return this.open_;
  }

  /** 開啟：記下開啟前的焦點、移除 hidden、把焦點移到面板內。已經開著時不動作（不會重新記下焦點）。 */
  open(): void {
    if (this.open_) return;
    const doc = this.root.ownerDocument;
    const active = doc.activeElement;
    this.returnTarget = active instanceof HTMLElement && active !== doc.body && !this.root.contains(active) ? active : null;
    this.open_ = true;
    this.root.hidden = false;
    modalStack.push(this);
    this.focusInitial();
  }

  /** 關閉：隱藏面板並依 restoreDecision 還原焦點。本來就沒開著時不動作。 */
  close(): void {
    if (!this.open_) return;
    const doc = this.root.ownerDocument;
    const focusWasInside = this.root.contains(doc.activeElement);
    const target = this.returnTarget;
    this.returnTarget = null;
    this.open_ = false;
    this.root.hidden = true;
    const at = modalStack.indexOf(this);
    if (at >= 0) modalStack.splice(at, 1);
    const decision = restoreDecision({
      modalsLeft: modalStack.length,
      focusWasInside,
      returnTargetUsable: target !== null && target.isConnected && target.closest('[hidden]') === null,
    });
    if (decision === 'return' && target) target.focus();
    else if (decision === 'top') modalStack[modalStack.length - 1]?.focusInitial();
  }

  /** 把焦點移到面板內第一個可互動元素；沒有時移到標題。面板沒開著時不動作。 */
  focusInitial(): void {
    if (!this.open_) return;
    const first = focusablesIn(this.root)[0] ?? this.title;
    first?.focus();
  }

  /** 內容重畫後，若焦點已經掉到面板外（被重畫掉的按鈕），把焦點放回面板內。面板沒開著時不動作。 */
  restoreFocusIfLost(): void {
    if (!this.open_) return;
    if (!this.root.contains(this.root.ownerDocument.activeElement)) this.focusInitial();
  }

  /**
   * 包住一次內容重畫：重畫前記下焦點位置，重畫後若焦點掉到面板外（被重畫掉的按鈕），依 focusRestoreTarget 放回。
   * 面板沒開著時等同直接呼叫 paint()。
   */
  redraw(paint: () => void): void {
    const memory = this.captureFocus();
    paint();
    this.restoreFocus(memory);
  }

  private captureFocus(): FocusMemory | null {
    if (!this.open_) return null;
    const active = this.root.ownerDocument.activeElement;
    if (!(active instanceof HTMLElement) || active === this.root || !this.root.contains(active)) return null;
    return {
      key: active.getAttribute('data-focus-key'),
      interactiveIndex: slotsIn(this.root)
        .filter(isInteractive)
        .indexOf(active),
    };
  }

  private restoreFocus(memory: FocusMemory | null): void {
    if (!this.open_ || memory === null) return;
    if (this.root.contains(this.root.ownerDocument.activeElement)) return;
    const slots = slotsIn(this.root);
    const target = focusRestoreTarget(memory, slots.map(describeSlot), this.title !== null);
    if (target.kind === 'slot') slots[target.index]?.focus();
    else if (target.kind === 'title') this.title?.focus();
  }

  /** 焦點陷阱用：在面板內循環一步。 */
  cycleFocus(backwards: boolean): void {
    const items = focusablesIn(this.root);
    if (items.length === 0) {
      this.title?.focus();
      return;
    }
    const current = items.indexOf(this.root.ownerDocument.activeElement as HTMLElement);
    items[nextFocusIndex(items.length, current, backwards)]?.focus();
  }
}

function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.tabIndex >= 0 && !el.matches(':disabled') && el.closest('[hidden]') === null,
  );
}

/** 焦點候選：可互動元素，加上帶 data-focus-key 的列文字（tabindex -1，只接受程式聚焦）。 */
const FOCUS_SLOT = `${FOCUSABLE}, [data-focus-key]`;

function slotsIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUS_SLOT)).filter((el) => el.closest('[hidden]') === null);
}

function isInteractive(el: HTMLElement): boolean {
  return el.tabIndex >= 0 && !el.matches(':disabled');
}

function describeSlot(el: HTMLElement): FocusSlot {
  return { key: el.getAttribute('data-focus-key'), disabled: el.matches(':disabled'), interactive: isInteractive(el) };
}

/** 每份文件只掛一次：Tab 只在有開著的模態面板時被攔下，循環在最後開啟的那一個面板內。 */
function trapTabKey(doc: Document): void {
  if (trappedDocuments.has(doc)) return;
  trappedDocuments.add(doc);
  doc.addEventListener(
    'keydown',
    (event) => {
      const top = modalStack[modalStack.length - 1];
      if (!top || event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      top.cycleFocus(event.shiftKey);
    },
    true,
  );
}
