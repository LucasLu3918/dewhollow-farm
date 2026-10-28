import type { ChangelogEntry, HelpContent, HelpKeyEntry } from '../infrastructure/content/info-content';
import { isCoarsePointer } from './apply-settings';
import { PanelDialog } from './panel-dialog';

/** 說明頁的一組按鍵：標題、列表，以及列表底下的提示（只有鍵盤按鍵有）。 */
export interface KeySection {
  title: string;
  entries: readonly HelpKeyEntry[];
  note?: string;
}

const KEYBOARD_NOTE = '以上是預設按鍵。已經在「設定」裡改過的按鍵，以設定為準；Esc 永遠用來關閉面板。';
const KEYBOARD_NOTE_TOUCH = '以上是預設按鍵。已經在「設定」裡改過的按鍵，以設定為準；按右上角的 × 關閉。';

/**
 * 按鍵區塊的順序（純函式）：觸控裝置先顯示畫面下方的按鍵，一般裝置先顯示鍵盤按鍵；兩組都會列出。
 * 提示文字也依裝置而定：觸控裝置不提 Esc，改提右上角的 ×。
 */
export function keySections(help: HelpContent, coarse: boolean): KeySection[] {
  const keyboard: KeySection = { title: '鍵盤按鍵', entries: help.controls, note: coarse ? KEYBOARD_NOTE_TOUCH : KEYBOARD_NOTE };
  const touch: KeySection = { title: '畫面下方的按鍵', entries: help.touch };
  return coarse ? [touch, keyboard] : [keyboard, touch];
}

/**
 * 說明頁（DOM）：操作按鍵（鍵盤與畫面下方的觸控按鍵）、版本號、更新日誌與隱私說明。
 * 文字全部來自 content/help.json 與 content/changelog.json。打開時不花體力與時間，也不經過應用層的指令。
 * coarse 預設依裝置的主要指標決定（見 isCoarsePointer），決定按鍵區塊的順序與關閉提示。
 */
export class HelpPanel {
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly dialog: PanelDialog;

  constructor(
    doc: Document,
    private readonly help: HelpContent,
    private readonly changelog: readonly ChangelogEntry[],
    version: string,
    private readonly coarse: boolean = isCoarsePointer(),
  ) {
    this.doc = doc;
    this.root = required(doc, '#help-panel');
    this.root.classList.add('ui-dialog-panel');
    this.dialog = new PanelDialog(this.root);
    this.body = required(doc, '#help-body');
    this.body.classList.add('ui-dialog-panel__content');
    const header = required(doc, '#help-panel > header');
    header.classList.add('ui-dialog-panel__header');
    required(doc, '#help-title').classList.add('ui-dialog-panel__title');
    const versionLabel = required(doc, '#help-version');
    versionLabel.textContent = `目前版本：v${version}`;
    versionLabel.classList.add('ui-dialog-panel__intro');
    required(doc, '#help-close').classList.add('ui-dialog-panel__close');
    required(doc, '#help-x').classList.add('ui-dialog-panel__close');
    required(doc, '#help-close').addEventListener('click', () => this.close());
    required(doc, '#help-x').addEventListener('click', () => this.close());
    this.render();
  }

  isOpen(): boolean {
    return this.dialog.isOpen();
  }

  open(): void {
    this.dialog.open();
  }

  close(): void {
    this.dialog.close();
  }

  toggle(): void {
    if (this.dialog.isOpen()) this.close();
    else this.open();
  }

  private render(): void {
    this.body.replaceChildren(
      this.section('操作按鍵', this.keyGroups()),
      this.section('更新日誌', this.history()),
      this.section(this.help.privacy.title, this.privacy()),
    );
  }

  // 同一個「操作按鍵」區段內，每組（鍵盤、畫面下方的按鍵）各有一個小標題。
  private keyGroups(): HTMLElement {
    const wrap = this.doc.createElement('div');
    for (const group of keySections(this.help, this.coarse)) {
      const heading = this.doc.createElement('h4');
      heading.textContent = group.title;
      wrap.append(heading, this.keyList(group));
    }
    return wrap;
  }

  private section(title: string, content: HTMLElement): HTMLElement {
    const section = this.doc.createElement('section');
    section.className = 'help-section ui-dialog-panel__section';
    const heading = this.doc.createElement('h3');
    heading.className = 'ui-dialog-panel__section-title';
    heading.textContent = title;
    section.append(heading, content);
    return section;
  }

  private keyList(group: KeySection): HTMLElement {
    const wrap = this.doc.createElement('div');
    const list = this.doc.createElement('ul');
    list.className = 'help-controls';
    for (const entry of group.entries) {
      const item = this.doc.createElement('li');
      const keys = this.doc.createElement('kbd');
      keys.textContent = entry.keys;
      const action = this.doc.createElement('span');
      action.textContent = entry.action;
      item.append(keys, action);
      list.append(item);
    }
    wrap.append(list);
    if (group.note) {
      const note = this.doc.createElement('p');
      note.className = 'help-note';
      note.textContent = group.note;
      wrap.append(note);
    }
    return wrap;
  }

  private history(): HTMLElement {
    const wrap = this.doc.createElement('div');
    for (const entry of this.changelog) {
      const heading = this.doc.createElement('h4');
      heading.textContent = `v${entry.version}　${entry.date}　${entry.title}`;
      const list = this.doc.createElement('ul');
      list.className = 'help-changes';
      for (const text of entry.items) {
        const item = this.doc.createElement('li');
        item.textContent = text;
        list.append(item);
      }
      wrap.append(heading, list);
    }
    return wrap;
  }

  private privacy(): HTMLElement {
    const wrap = this.doc.createElement('div');
    for (const text of this.help.privacy.paragraphs) {
      const paragraph = this.doc.createElement('p');
      paragraph.textContent = text;
      wrap.append(paragraph);
    }
    return wrap;
  }
}

function required<T extends Element = HTMLElement>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`頁面缺少必要元素 ${selector}`);
  return found;
}
