import type { GameState } from '../domain/game-state';
import { NO_FRIENDSHIP, heartsOf } from '../domain/friendship';
import { totalDay } from '../domain/calendar';
import { countOf } from '../domain/inventory';
import type { Command } from '../application/game-commands';
import type { ContentIndex } from '../application/content-index';
import { residentsOn } from '../application/residents';
import { warmGiftOpen } from '../application/festival';

/**
 * 居民與好感面板（DOM）：每位居民的顆心、今天是否已對話與送禮、喜歡的東西，以及送禮的下拉選單。
 * 規則（好感多少、能不能送）都在應用層；這裡只呈現狀態並送出指令。
 */
export class ResidentPanel {
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly list: HTMLElement;
  private open_ = false;

  constructor(
    doc: Document,
    private readonly index: ContentIndex,
    private readonly onCommand: (command: Command) => void,
  ) {
    this.doc = doc;
    this.root = required(doc, '#resident-panel');
    this.summary = required(doc, '#resident-summary');
    this.list = required(doc, '#resident-list');
    required(doc, '#resident-close').addEventListener('click', () => this.close());
  }

  isOpen(): boolean {
    return this.open_;
  }

  toggle(state: GameState): void {
    if (this.open_) this.close();
    else this.open(state);
  }

  open(state: GameState): void {
    this.open_ = true;
    this.root.hidden = false;
    this.render(state);
  }

  refresh(state: GameState): void {
    if (this.open_) this.render(state);
  }

  close(): void {
    this.open_ = false;
    this.root.hidden = true;
  }

  private render(state: GameState): void {
    const rules = this.index.friendship;
    const today = totalDay(state.calendar, this.index.tuning.time.daysPerSeason);
    const here = new Set(residentsOn(state, this.index).map((r) => r.npcId));
    this.summary.textContent = `每人每天可以各聊一次、送一次禮。送禮要站在他面前（面向他）。`;
    this.list.replaceChildren();
    for (const npc of this.index.npcs) {
      const f = state.friendship[npc.id] ?? NO_FRIENDSHIP;
      const hearts = heartsOf(f.points, rules);
      const loves = npc.loves.map((id) => this.index.item(id).name).join('、');
      const status = [
        f.talkedDay === today ? '今天已聊過' : '今天還沒聊',
        warmGiftOpen(state, this.index, npc.id) ? '暖燈禮物還可以送' : f.giftedDay === today ? '今天已送禮' : '今天還可以送禮',
        here.has(npc.id) ? '現在在這裡' : '現在不在這裡',
      ].join('・');
      const item = this.doc.createElement('li');
      const text = this.doc.createElement('span');
      text.textContent = `${npc.name}　${'♥'.repeat(hearts)}${'♡'.repeat(Math.max(0, rules.maxHearts - hearts))}（${hearts} 顆心）　${status}　喜歡：${loves || '（還不知道）'}`;
      item.append(text, this.giftControl(state, npc.id));
      this.list.append(item);
    }
  }

  /** 送禮：下拉選單列出背包裡的東西，按「送出」才送。 */
  private giftControl(state: GameState, npcId: string): HTMLElement {
    const wrap = this.doc.createElement('span');
    const select = this.doc.createElement('select');
    const stacks = [...new Set(state.inventory.stacks.map((s) => s.itemId))];
    for (const itemId of stacks) {
      const option = this.doc.createElement('option');
      option.value = itemId;
      option.textContent = `${this.index.item(itemId).name} × ${countOf(state.inventory, itemId)}`;
      select.append(option);
    }
    const button = this.doc.createElement('button');
    button.type = 'button';
    button.textContent = '送出';
    button.disabled = stacks.length === 0;
    button.addEventListener('click', () => {
      if (select.value) this.onCommand({ type: 'giveGift', npcId, itemId: select.value });
    });
    wrap.append(select, button);
    return wrap;
  }
}

function required<T extends Element = HTMLElement>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`頁面缺少必要元素 ${selector}`);
  return found;
}
