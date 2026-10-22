import type { GameState } from '../domain/game-state';
import { levelOf, SKILL_NAMES, type SkillId } from '../domain/skills';
import type { Command } from '../application/game-commands';
import type { ContentIndex } from '../application/content-index';

/**
 * 工作台面板（DOM）：列出合成配方、需要的材料與解鎖條件。按鈕只送出指令；
 * 材料夠不夠、技能夠不夠、灑水器是不是已經有了，都由應用層判斷。
 */
export class WorkbenchPanel {
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
    this.root = required(doc, '#workbench-panel');
    this.funds = required(doc, '#workbench-funds');
    this.list = required(doc, '#workbench-list');
    required(doc, '#workbench-close').addEventListener('click', () => this.close());
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
    this.funds.textContent = `背包：${state.inventory.stacks.length} / ${state.inventory.capacity} 格`;
    this.list.replaceChildren();
    for (const recipe of this.index.craftingRecipes) {
      const needs = Object.entries(recipe.ingredients)
        .map(([itemId, count]) => `${this.index.item(itemId).name} × ${count}`)
        .join('、');
      const notes: string[] = [];
      if (recipe.unlock && 'skill' in recipe.unlock) {
        const skill = recipe.unlock.skill as SkillId;
        if (levelOf(state.skills[skill], this.index.tuning.skills.thresholds) < recipe.unlock.level) {
          notes.push(`需要${SKILL_NAMES[skill]} ${recipe.unlock.level} 級`);
        }
      }
      if (recipe.unlock && 'flag' in recipe.unlock && state.flags[recipe.unlock.flag] !== true) {
        notes.push('還沒解鎖（夜市的星河兌換）');
      }
      if (recipe.effect?.type === 'flag' && state.flags[recipe.effect.flag]) notes.push('已經有了');
      const suffix = notes.length > 0 ? `（${notes.join('；')}）` : '';
      this.addRow(`${recipe.name}：${needs}${suffix}`, '做', () => this.onCommand({ type: 'craft', recipeId: recipe.id }));
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
