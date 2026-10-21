import type { GameState } from '../domain/game-state';
import { countOf } from '../domain/inventory';
import { levelOf } from '../domain/skills';
import type { Command } from '../application/game-commands';
import type { ContentIndex } from '../application/content-index';

/**
 * 廚房面板（DOM）：列出食譜（做）與背包裡的料理（吃）。按鈕只送出指令；
 * 材料夠不夠、烹飪等級夠不夠，都由應用層判斷。
 */
export class KitchenPanel {
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
    this.root = required(doc, '#kitchen-panel');
    this.funds = required(doc, '#kitchen-funds');
    this.list = required(doc, '#kitchen-list');
    required(doc, '#kitchen-close').addEventListener('click', () => this.close());
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
    this.funds.textContent = `你的金幣：${state.gold}　烹飪等級：${level}`;
    this.list.replaceChildren();
    for (const recipe of this.index.recipes) {
      const needs = Object.entries(recipe.ingredients)
        .map(([itemId, count]) => `${this.index.item(itemId).name} × ${count}`)
        .join('、');
      this.addRow(`做：${recipe.name}（${needs}；吃了 +${recipe.energy} 體力）`, '做', () =>
        this.onCommand({ type: 'cook', recipeId: recipe.id }),
      );
    }
    for (const recipe of this.index.recipes) {
      const itemId = `dish.${recipe.id}`;
      const count = countOf(state.inventory, itemId);
      if (count > 0) this.addRow(`${recipe.name} × ${count}`, '吃', () => this.onCommand({ type: 'eat', itemId }));
    }
  }

  private addRow(label: string, buttonText: string, onClick: () => void): void {
    const item = this.doc.createElement('li');
    const text = this.doc.createElement('span');
    text.textContent = label;
    const button = this.doc.createElement('button');
    button.type = 'button';
    button.textContent = buttonText;
    button.addEventListener('click', onClick);
    item.append(text, button);
    this.list.append(item);
  }
}

function required<T extends Element = HTMLElement>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`頁面缺少必要元素 ${selector}`);
  return found;
}
