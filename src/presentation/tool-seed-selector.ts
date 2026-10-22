import type { ContentIndex } from '../application/content-index';
import type { Command } from '../application/game-commands';
import type { GameState } from '../domain/game-state';
import { countOf } from '../domain/inventory';
import { seedItemId } from '../domain/items';
import { TOOL_IDS, TOOL_NAMES } from '../domain/tools';
import { PanelDialog } from './panel-dialog';

const WHEEL_PAGE_SIZE = 8;

/** Temporary DOM selector for held tools and owned seeds; game rules stay in application commands. */
export class ToolSeedSelector {
  private readonly root: HTMLElement;
  private readonly dialog: PanelDialog;
  private readonly title: HTMLElement;
  private readonly list: HTMLElement;
  private readonly page: HTMLElement;
  private readonly note: HTMLElement;
  private mode: 'tool' | 'seed' = 'tool';
  private wheel = false;
  private pageIndex = 0;
  private state: GameState | null = null;

  constructor(
    private readonly doc: Document,
    private readonly index: ContentIndex,
    private readonly onCommand: (command: Command) => void,
  ) {
    this.root = required(doc, '#tool-seed-panel');
    this.dialog = new PanelDialog(this.root);
    this.title = required(doc, '#tool-seed-title');
    this.list = required(doc, '#tool-seed-list');
    this.page = required(doc, '#tool-seed-page');
    this.note = required(doc, '#tool-seed-note');
    required(doc, '#tool-seed-close').addEventListener('click', () => this.close());
    required(doc, '#tool-seed-prev').addEventListener('click', () => this.changePage(-1));
    required(doc, '#tool-seed-next').addEventListener('click', () => this.changePage(1));
  }

  isOpen(): boolean { return this.dialog.isOpen(); }
  close(): void { this.state = null; this.dialog.close(); }

  open(mode: 'tool' | 'seed', wheel: boolean, state: GameState): void {
    this.mode = mode;
    this.wheel = wheel;
    this.pageIndex = 0;
    this.state = state;
    this.render();
    this.dialog.open();
  }

  private changePage(delta: number): void {
    const { pageIndex } = pageOf(this.entries(), this.pageIndex + delta);
    this.pageIndex = pageIndex;
    this.render();
  }

  private entries(): { id: string; name: string; count?: number; command: Command }[] {
    const state = this.state;
    if (!state) return [];
    if (this.mode === 'tool') return TOOL_IDS.map((tool) => ({
      id: tool, name: TOOL_NAMES[tool], command: { type: 'takeTool', tool },
    }));
    return this.index.cropIds().flatMap((cropId) => {
      const count = countOf(state.inventory, seedItemId(cropId));
      if (count < 1) return [];
      const crop = this.index.crop(cropId);
      return [{ id: cropId, name: crop.name, count, command: { type: 'selectSeed', cropId } as Command }];
    });
  }

  private render(): void {
    if (!this.state) return;
    const all = this.entries();
    const page = pageOf(all, this.pageIndex);
    this.pageIndex = page.pageIndex;
    const pages = page.pageCount;
    const visible = this.wheel ? page.items : all;
    this.title.textContent = this.mode === 'tool' ? (this.wheel ? '工具輪盤' : '選擇工具') : (this.wheel ? '種子輪盤' : '選擇種子');
    this.note.hidden = this.mode !== 'seed';
    this.note.textContent = '非當季種子仍可選；一般田地的播種季節限制照常套用，溫室除外。';
    this.list.classList.toggle('tool-seed-wheel', this.wheel);
    this.list.replaceChildren();
    if (visible.length === 0) {
      const empty = this.doc.createElement('li');
      empty.textContent = this.mode === 'seed' ? '背包裡沒有種子' : '沒有可選項目';
      this.list.append(empty);
    }
    for (const [index, entry] of visible.entries()) {
      const row = this.doc.createElement('li');
      const button = this.doc.createElement('button');
      button.type = 'button';
      button.dataset.selectorId = entry.id;
      button.textContent = entry.count === undefined ? entry.name : `${entry.name}　× ${entry.count}`;
      button.setAttribute('aria-label', entry.count === undefined ? entry.name : `${entry.name}，${entry.count} 包`);
      if (this.wheel) {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(1, visible.length);
        const radius = Math.min(96, Math.max(72, this.root.clientWidth * 0.25));
        button.style.setProperty('--wheel-x', `${Math.cos(angle) * radius}px`);
        button.style.setProperty('--wheel-y', `${Math.sin(angle) * radius}px`);
      }
      button.addEventListener('click', () => {
        const command = entry.command;
        this.close();
        this.onCommand(command);
      });
      row.append(button);
      this.list.append(row);
    }
    const paged = this.wheel && pages > 1;
    required(this.doc, '#tool-seed-prev').hidden = !paged;
    required(this.doc, '#tool-seed-next').hidden = !paged;
    this.page.hidden = !paged;
    this.page.textContent = `${this.pageIndex + 1} / ${pages}`;
    this.dialog.redraw(() => undefined);
  }
}

export function pageOf<T>(items: readonly T[], requestedPage: number, pageSize = WHEEL_PAGE_SIZE): { pageIndex: number; pageCount: number; items: T[] } {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const pageIndex = (requestedPage % pageCount + pageCount) % pageCount;
  return { pageIndex, pageCount, items: items.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize) };
}

function required<T extends Element = HTMLElement>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`頁面缺少必要元素 ${selector}`);
  return found;
}
