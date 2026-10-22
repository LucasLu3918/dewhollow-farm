import type { GameState } from '../domain/game-state';
import { heartsOf } from '../domain/friendship';
import type { Command } from '../application/game-commands';
import type { ContentIndex } from '../application/content-index';
import { PanelDialog } from './panel-dialog';

/**
 * 心形事件面板（DOM，模態）：依序顯示事件的每一頁，最後列出選項。
 * 事件是否進行中、選項是否有效都由應用層的 pendingHeartEvent 決定；這裡只記住目前翻到第幾頁。
 */
export class HeartEventPanel {
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly body: HTMLElement;
  private readonly options: HTMLElement;
  private readonly next: HTMLButtonElement;
  private readonly dialog: PanelDialog;
  /** 目前顯示的事件 id（事件結束後清掉）。 */
  private shownId: string | null = null;
  private page = 0;

  constructor(
    doc: Document,
    private readonly index: ContentIndex,
    private readonly onCommand: (command: Command) => void,
  ) {
    this.doc = doc;
    this.root = required(doc, '#heart-event-panel');
    this.dialog = new PanelDialog(this.root);
    this.title = required(doc, '#heart-event-title');
    this.body = required(doc, '#heart-event-body');
    this.options = required(doc, '#heart-event-options');
    this.next = required<HTMLButtonElement>(doc, '#heart-event-next');
    this.next.addEventListener('click', () => {
      this.page += 1;
      if (this.lastState) this.render(this.lastState);
      this.dialog.restoreFocusIfLost();
    });
  }

  private lastState: GameState | null = null;

  /** 模態：開著時焦點陷阱生效；但不吃 Esc（見 MapScene.handleKey）。 */
  isOpen(): boolean {
    return this.dialog.isOpen();
  }

  /** 依目前狀態開啟、更新或關閉面板：有進行中的事件就顯示，沒有就關掉。 */
  sync(state: GameState): void {
    this.lastState = state;
    const pending = state.pendingHeartEvent;
    if (!pending) {
      this.shownId = null;
      this.dialog.close();
      return;
    }
    if (pending !== this.shownId) {
      this.shownId = pending;
      this.page = 0;
    }
    this.render(state);
    this.dialog.open();
    this.dialog.restoreFocusIfLost();
  }

  private render(state: GameState): void {
    const event = this.index.heartEvent(this.shownId ?? '');
    const npc = this.index.npc(event.npcId);
    const hearts = heartsOf(state.friendship[npc.id]?.points ?? 0, this.index.friendship);
    this.title.textContent = `${npc.name}（${hearts} 顆心）`;
    this.options.replaceChildren();
    const showingOptions = this.page >= event.pages.length;
    const line = this.doc.createElement('p');
    if (showingOptions) {
      line.textContent = '你想怎麼回應？';
      this.body.replaceChildren(line);
      this.next.hidden = true;
      for (const option of event.options) {
        const item = this.doc.createElement('li');
        const button = this.doc.createElement('button');
        button.type = 'button';
        button.textContent = option.label;
        button.addEventListener('click', () => this.onCommand({ type: 'chooseHeartOption', optionId: option.id }));
        item.append(button);
        this.options.append(item);
      }
    } else {
      line.textContent = event.pages[this.page] ?? '';
      this.body.replaceChildren(line);
      this.next.hidden = false;
    }
  }
}

function required<T extends Element = HTMLElement>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`頁面缺少必要元素 ${selector}`);
  return found;
}
