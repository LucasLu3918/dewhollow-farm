import type { ContentIndex } from '../application/content-index';
import type { Command } from '../application/game-commands';
import type { GameState, HotbarItem } from '../domain/game-state';
import { countOf } from '../domain/inventory';
import { seedItemId } from '../domain/items';
import { TOOL_IDS, TOOL_NAMES } from '../domain/tools';

/** 四格快捷欄是純選取工具／種子的 DOM HUD；實際規則仍交由 GameSession 指令處理。 */
export class Hotbar {
  private readonly uses: HTMLButtonElement[];
  private readonly editModeButton: HTMLButtonElement;
  private editMode = false;

  constructor(
    private readonly doc: Document,
    private readonly index: ContentIndex,
    private readonly getState: () => GameState,
    private readonly dispatch: (command: Command) => void,
    private readonly edit: (slot: number, state: GameState) => void,
  ) {
    const root = required<HTMLElement>(doc, '#quickbar');
    const toggle = required<HTMLButtonElement>(doc, '#quickbar-toggle');
    this.uses = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-hotbar-use]'));
    this.editModeButton = required<HTMLButtonElement>(root, '[data-hotbar-edit-mode]');
    if (this.uses.length !== 4) throw new Error('快捷欄需要四個使用按鈕');
    toggle.addEventListener('click', () => {
      const isOpen = root.dataset.open === 'true';
      root.dataset.open = String(!isOpen);
      toggle.setAttribute('aria-expanded', String(!isOpen));
    });
    this.editModeButton.addEventListener('click', () => {
      this.editMode = !this.editMode;
      this.refresh(this.getState());
    });
    this.uses.forEach((button, slot) => button.addEventListener('click', () => {
      const state = this.getState();
      if (this.editMode) {
        this.editMode = false;
        this.refresh(state);
        this.closeCompact(root, toggle);
        this.edit(slot, state);
        return;
      }
      const command = hotbarCommandForSlot(state.hotbar[slot] ?? null, state, this.index);
      if (command) {
        this.closeCompact(root, toggle);
        this.dispatch(command);
      }
    }));
  }

  refresh(state: GameState): void {
    this.uses.forEach((button, slot) => {
      const item = state.hotbar[slot] ?? null;
      const label = labelOf(item, state, this.index);
      const command = hotbarCommandForSlot(item, state, this.index);
      button.textContent = `${slot + 1} ${label}`;
      button.disabled = !this.editMode && command === null;
      button.dataset.active = String(isSelected(item, state));
      button.setAttribute('aria-pressed', String(isSelected(item, state)));
      button.setAttribute('aria-label', this.editMode
        ? `設定快捷欄第 ${slot + 1} 格，目前為${label}`
        : `快捷欄第 ${slot + 1} 格：${label}${command ? '，按下使用' : '，無法使用'}`);
    });
    this.editModeButton.setAttribute('aria-pressed', String(this.editMode));
    this.editModeButton.textContent = this.editMode ? '選格' : '編輯';
  }

  private closeCompact(root: HTMLElement, toggle: HTMLButtonElement): void {
    root.dataset.open = 'false';
    toggle.setAttribute('aria-expanded', 'false');
  }
}

/** 不接受空格、未知內容或已用完的種子，避免送出任何會改變遊戲狀態的指令。 */
export function hotbarCommandForSlot(item: HotbarItem, state: GameState, index: ContentIndex): Command | null {
  if (!item) return null;
  if (item.kind === 'tool') return TOOL_IDS.includes(item.tool) ? { type: 'takeTool', tool: item.tool } : null;
  if (item.kind === 'seed') {
    if (!index.cropIds().includes(item.cropId) || countOf(state.inventory, seedItemId(item.cropId)) < 1) return null;
    return { type: 'selectSeed', cropId: item.cropId };
  }
  return null;
}

function labelOf(item: HotbarItem, state: GameState, index: ContentIndex): string {
  if (!item) return '空格';
  if (item.kind === 'tool') return TOOL_NAMES[item.tool] ?? '無效工具';
  if (item.kind === 'seed') {
    const count = countOf(state.inventory, seedItemId(item.cropId));
    if (!index.cropIds().includes(item.cropId)) return '無效種子';
    return `${index.crop(item.cropId).name}${count > 0 ? ` ×${count}` : '（已用完）'}`;
  }
  return '無效項目';
}

function isSelected(item: HotbarItem, state: GameState): boolean {
  return item?.kind === 'tool'
    ? state.tool === item.tool
    : item?.kind === 'seed' && state.tool === 'seedbag' && state.selectedSeed === item.cropId;
}

function required<T extends Element = HTMLElement>(doc: ParentNode, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`頁面缺少必要元素 ${selector}`);
  return found;
}
