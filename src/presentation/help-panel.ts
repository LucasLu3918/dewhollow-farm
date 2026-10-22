import type { ChangelogEntry, HelpContent } from '../infrastructure/content/info-content';
import { PanelDialog } from './panel-dialog';

/**
 * 說明頁（DOM）：操作按鍵、版本號、更新日誌與隱私說明。文字全部來自 content/help.json 與 content/changelog.json。
 * 打開時不花體力與時間，也不經過應用層的指令。
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
  ) {
    this.doc = doc;
    this.root = required(doc, '#help-panel');
    this.dialog = new PanelDialog(this.root);
    this.body = required(doc, '#help-body');
    required(doc, '#help-version').textContent = `目前版本：v${version}`;
    required(doc, '#help-close').addEventListener('click', () => this.close());
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
      this.section('操作按鍵', this.controls()),
      this.section('更新日誌', this.history()),
      this.section(this.help.privacy.title, this.privacy()),
    );
  }

  private section(title: string, content: HTMLElement): HTMLElement {
    const section = this.doc.createElement('section');
    section.className = 'help-section';
    const heading = this.doc.createElement('h3');
    heading.textContent = title;
    section.append(heading, content);
    return section;
  }

  private controls(): HTMLElement {
    const wrap = this.doc.createElement('div');
    const list = this.doc.createElement('ul');
    list.className = 'help-controls';
    for (const control of this.help.controls) {
      const item = this.doc.createElement('li');
      const keys = this.doc.createElement('kbd');
      keys.textContent = control.keys;
      const action = this.doc.createElement('span');
      action.textContent = control.action;
      item.append(keys, action);
      list.append(item);
    }
    const note = this.doc.createElement('p');
    note.className = 'help-note';
    note.textContent = '以上是預設按鍵。已經在「設定」裡改過的按鍵，以設定為準；Esc 永遠用來關閉面板。';
    wrap.append(list, note);
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
