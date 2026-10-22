import type { GameState } from '../domain/game-state';
import { messageFor, type Command } from '../application/game-commands';
import type { ContentIndex } from '../application/content-index';
import { countOf } from '../domain/inventory';
import { SEASON_NAMES } from '../domain/calendar';
import { donationCap, donationRefusal, goalProgress, recordOf, seasonOpen, type RepairDef } from '../domain/repairs';
import { PanelDialog } from './panel-dialog';

/**
 * 修復告示的面板（DOM）：廣場「修復委員會」的每項修復、進度與捐獻按鈕。
 * 能不能捐、為什麼不能捐由 domain（repairs.ts）與應用層決定；這裡只呈現狀態並送出指令。
 */
export class RepairPanel {
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly list: HTMLElement;
  private readonly dialog: PanelDialog;

  constructor(
    doc: Document,
    private readonly index: ContentIndex,
    private readonly onCommand: (command: Command) => void,
  ) {
    this.doc = doc;
    this.root = required(doc, '#repair-panel');
    this.dialog = new PanelDialog(this.root);
    this.summary = required(doc, '#repair-summary');
    this.list = required(doc, '#repair-list');
    required(doc, '#repair-close').addEventListener('click', () => this.close());
  }

  isOpen(): boolean {
    return this.dialog.isOpen();
  }

  open(state: GameState): void {
    this.render(state);
    this.dialog.open();
  }

  refresh(state: GameState): void {
    if (this.dialog.isOpen()) this.render(state);
  }

  close(): void {
    this.dialog.close();
  }

  private render(state: GameState): void {
    this.list.replaceChildren();
    const open = this.index.repairs.filter((def) => seasonOpen(def, state.calendar));
    this.summary.textContent =
      open.length > 0
        ? `${SEASON_NAMES[state.calendar.season]}的修復正在進行。捐出的東西會從背包拿走，不花體力與時間。`
        : `${SEASON_NAMES[state.calendar.season]}沒有進行中的修復。每個季節委員會會貼出一項新的修復。`;
    for (const def of this.index.repairs) this.repairSection(state, def);
  }

  private repairSection(state: GameState, def: RepairDef): void {
    const record = recordOf(state.repairs, def.id, state.calendar.year);
    const { value, target } = goalProgress(def.goal, record.donated);
    const status = record.done ? '已完成' : `${value}/${target}`;
    this.heading(`${def.name}（${SEASON_NAMES[def.season]}）：${status}`);
    this.item(def.request);
    if (record.done) {
      this.item(def.done);
      return;
    }
    if (!seasonOpen(def, state.calendar)) {
      this.item('這一項要等它的季節才能捐。');
      return;
    }
    for (const itemId of def.goal.pool) {
      const have = countOf(state.inventory, itemId);
      const name = this.index.item(itemId).name;
      const donated = record.donated[itemId] ?? 0;
      const need = `已捐 ${donated}/${def.goal.each}`;
      const cap = Math.min(have, donationCap(def.goal, record.donated, itemId));
      const label = `${name}：${need}，背包有 ${have}`;
      const refusal = (count: number) => donationRefusal(def, record, itemId, count) ?? (have < count ? 'NO_MATERIAL' : null);
      this.item(label, { label: '捐一件', disabled: refusal(1) !== null, reason: refusal(1), onClick: () => this.donate(def.id, itemId, 1) });
      if (cap > 1) {
        this.item(`可以一次捐 ${cap} 件`, { label: `捐 ${cap} 件`, disabled: refusal(cap) !== null, reason: refusal(cap), onClick: () => this.donate(def.id, itemId, cap) });
      }
    }
  }

  private donate(repairId: string, itemId: string, count: number): void {
    this.onCommand({ type: 'donate', repairId, itemId, count });
  }

  private heading(text: string): void {
    const item = this.doc.createElement('li');
    item.className = 'quest-heading';
    item.textContent = text;
    this.list.append(item);
  }

  private item(text: string, action?: { label: string; disabled?: boolean; reason?: string | null; onClick?: () => void }): void {
    const item = this.doc.createElement('li');
    const span = this.doc.createElement('span');
    span.textContent = text;
    item.append(span);
    if (action) {
      const button = this.doc.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      button.disabled = action.disabled === true;
      if (action.disabled && action.reason) button.title = messageFor(action.reason);
      if (action.onClick) button.addEventListener('click', action.onClick);
      item.append(button);
    }
    this.list.append(item);
  }
}

function required<T extends Element = HTMLElement>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`頁面缺少必要元素 ${selector}`);
  return found;
}
