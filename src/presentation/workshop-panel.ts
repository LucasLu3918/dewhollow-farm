import type { GameState } from '../domain/game-state';
import { takeReady } from '../domain/processing';
import { levelOf } from '../domain/skills';
import type { Command } from '../application/game-commands';
import type { ContentIndex } from '../application/content-index';

/**
 * 加工台面板（DOM）：列出加工配方（放入）、正在加工的批次與已完成的成品（取回）。
 * 按鈕只送出指令；材料夠不夠、機器有沒有空位，都由應用層判斷。
 */
export class WorkshopPanel {
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly funds: HTMLElement;
  private readonly list: HTMLElement;
  private open_ = false;

  constructor(
    doc: Document,
    private readonly index: ContentIndex,
    private readonly onCommand: (command: Command) => void,
  ) {
    this.doc = doc;
    this.root = required(doc, '#workshop-panel');
    this.funds = required(doc, '#workshop-funds');
    this.list = required(doc, '#workshop-list');
    required(doc, '#workshop-close').addEventListener('click', () => this.close());
  }

  isOpen(): boolean {
    return this.open_;
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
    const level = levelOf(state.skills.cooking, this.index.tuning.skills.thresholds);
    const slots = this.index.tuning.processing.slots;
    this.funds.textContent = `加工中：${state.processing.length} / ${slots} 批　烹飪等級：${level}`;
    this.list.replaceChildren();

    const { ready, remaining } = takeReady(state.processing);
    if (ready.length > 0) {
      const names = ready.map((job) => this.nameOfOutput(job.recipeId)).join('、');
      this.addRow(`已完成：${names}`, '全部取回', () => this.onCommand({ type: 'collectProcessing' }));
    }
    for (const job of remaining) {
      const recipe = this.index.processingRecipe(job.recipeId);
      this.addRow(`加工中：${recipe.name}（還要 ${job.daysLeft} 天）`, '', null);
    }
    for (const recipe of this.index.processingRecipes) {
      const needs = Object.entries(recipe.ingredients)
        .map(([itemId, count]) => `${this.index.item(itemId).name} × ${count}`)
        .join('、');
      const label = `放：${recipe.name}（${needs}；${recipe.days} 天）`;
      this.addRow(label, '放入', () => this.onCommand({ type: 'startProcessing', recipeId: recipe.id }));
    }
  }

  private nameOfOutput(recipeId: string): string {
    return this.index.item(this.index.processingRecipe(recipeId).output).name;
  }

  /** 沒有按鈕（onClick 為 null）的列只顯示狀態。 */
  private addRow(label: string, buttonText: string, onClick: (() => void) | null): void {
    const item = this.doc.createElement('li');
    const text = this.doc.createElement('span');
    text.textContent = label;
    item.append(text);
    if (onClick) {
      const button = this.doc.createElement('button');
      button.type = 'button';
      button.textContent = buttonText;
      button.addEventListener('click', onClick);
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
