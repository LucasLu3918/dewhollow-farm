import type { GameState } from '../domain/game-state';
import type { QuestDef } from '../domain/quests';
import type { Command } from '../application/game-commands';
import type { ContentIndex } from '../application/content-index';
import { questBoardView, type QuestEntry } from '../application/quests';
import { PanelDialog } from './panel-dialog';

/**
 * 委託與佈告欄面板（DOM）：進行中的委託（含進度與交付）、今天佈告欄上的委託、已開放的居民委託。
 * 哪些委託能接、進度多少都在應用層；這裡只呈現狀態並送出指令（接取、交付）。
 */
const SECTIONS: { id: QuestEntry['section']; label: string }[] = [
  { id: 'active', label: '進行中' },
  { id: 'board', label: '佈告欄（今天）' },
  { id: 'resident', label: '居民委託' },
];

const STATE_LABEL: Record<QuestEntry['state'], string> = {
  open: '可接取',
  active: '進行中',
  done: '已完成',
};

export class QuestPanel {
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
    this.root = required(doc, '#quest-panel');
    this.dialog = new PanelDialog(this.root);
    this.summary = required(doc, '#quest-summary');
    this.list = required(doc, '#quest-list');
    required(doc, '#quest-close').addEventListener('click', () => this.close());
  }

  isOpen(): boolean {
    return this.dialog.isOpen();
  }

  toggle(state: GameState): void {
    if (this.dialog.isOpen()) this.close();
    else this.open(state);
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
    this.dialog.redraw(() => this.paint(state));
  }

  private paint(state: GameState): void {
    const entries = questBoardView(state, this.index);
    this.summary.textContent = `佈告欄每天換一次新委託，每週有一件大委託；居民委託要先和他熟起來才會開放。做完佈告欄的委託還能再接。圖鑑碎片：${state.dexFragments}`;
    this.list.replaceChildren();
    for (const section of SECTIONS) {
      const heading = this.doc.createElement('li');
      heading.className = 'quest-heading';
      heading.textContent = section.label;
      this.list.append(heading);
      const items = entries.filter((entry) => entry.section === section.id);
      if (items.length === 0) {
        const empty = this.doc.createElement('li');
        empty.textContent = '（目前沒有）';
        this.list.append(empty);
        continue;
      }
      for (const entry of items) this.list.append(this.row(entry));
    }
  }

  private row(entry: QuestEntry): HTMLElement {
    const def = entry.def;
    const item = this.doc.createElement('li');
    const text = this.doc.createElement('span');
    text.textContent = `${def.title}（${this.posterOf(def)}）　${STATE_LABEL[entry.state]}　${this.goalText(entry)}　獎勵：${this.rewardText(def) || '無'}　${def.request}`;
    item.append(text, this.actionControl(entry));
    return item;
  }

  private actionControl(entry: QuestEntry): HTMLElement {
    const wrap = this.doc.createElement('span');
    if (entry.canSubmit) {
      const submit = this.doc.createElement('button');
      submit.type = 'button';
      submit.textContent = '交付';
      submit.addEventListener('click', () => this.onCommand({ type: 'submitQuest', questId: entry.def.id }));
      wrap.append(submit);
    } else if (entry.state === 'open') {
      const accept = this.doc.createElement('button');
      accept.type = 'button';
      accept.textContent = '接取';
      accept.addEventListener('click', () => this.onCommand({ type: 'acceptQuest', questId: entry.def.id }));
      wrap.append(accept);
    }
    return wrap;
  }

  private posterOf(def: QuestDef): string {
    if (def.giver) return `委託人：${this.index.npc(def.giver).name}`;
    return `發布：${this.index.bulletin.postedBy}`;
  }

  /** 目標的進度文字，例如「2/3」；交付型的進度是背包裡的數量。 */
  private goalText(entry: QuestEntry): string {
    if (entry.state === 'done') return '';
    const { value, target } = entry.progress;
    return `進度 ${value}/${target}`;
  }

  private rewardText(def: QuestDef): string {
    const reward = def.reward;
    const parts: string[] = [];
    if (reward.gold) parts.push(`${reward.gold} 金`);
    for (const [itemId, count] of Object.entries(reward.items ?? {})) parts.push(`${this.index.item(itemId).name} × ${count}`);
    if (reward.friendship && def.giver) parts.push(`${this.index.npc(def.giver).name}的好感 +${reward.friendship}`);
    if (reward.fragments) parts.push(`圖鑑碎片 +${reward.fragments}`);
    return parts.join('、');
  }
}

function required<T extends Element = HTMLElement>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`頁面缺少必要元素 ${selector}`);
  return found;
}
