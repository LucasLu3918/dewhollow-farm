import type { ContentPack } from '../domain/content';
import { formatClock } from '../domain/calendar';
import type { GameState, ToolId } from '../domain/game-state';

const TOOL_LABEL: Record<ToolId, string> = {
  hoe: '鋤頭',
  can: '水壺',
  seedbag: '種子袋',
};

const LOG_LIMIT = 6;

/** DOM 版 HUD：只負責把狀態呈現到頁面上，不含任何規則。 */
export class Hud {
  private readonly clock: HTMLElement;
  private readonly day: HTMLElement;
  private readonly gold: HTMLElement;
  private readonly energyFill: HTMLElement;
  private readonly energyText: HTMLElement;
  private readonly tool: HTMLElement;
  private readonly seed: HTMLElement;
  private readonly log: HTMLElement;

  constructor(doc: Document) {
    this.clock = required(doc, '#hud-clock');
    this.day = required(doc, '#hud-day');
    this.gold = required(doc, '#hud-gold');
    this.energyFill = required(doc, '#hud-energy-fill');
    this.energyText = required(doc, '#hud-energy-text');
    this.tool = required(doc, '#hud-tool');
    this.seed = required(doc, '#hud-seed');
    this.log = required(doc, '#hud-log');
  }

  update(state: GameState, pack: ContentPack): void {
    this.clock.textContent = formatClock(state.calendar);
    this.day.textContent = `第 ${state.calendar.day} 天`;
    this.gold.textContent = `${state.gold} 金`;
    const ratio = Math.max(0, Math.min(1, state.energy.current / (state.energy.max || 1)));
    this.energyFill.style.width = `${Math.round(ratio * 100)}%`;
    this.energyText.textContent = `${state.energy.current} / ${state.energy.max}`;
    this.tool.textContent = TOOL_LABEL[state.tool];
    const crop = pack.crops.find((c) => c.id === state.selectedSeed);
    this.seed.textContent = state.tool === 'seedbag' ? `種子：${crop?.name ?? state.selectedSeed}` : '';
  }

  messages(lines: readonly string[]): void {
    for (const line of lines) this.append(line, 'info');
  }

  error(message: string): void {
    this.append(message, 'error');
  }

  private append(text: string, level: 'info' | 'error'): void {
    const item = document.createElement('li');
    item.textContent = text;
    item.className = level;
    this.log.append(item);
    while (this.log.children.length > LOG_LIMIT) this.log.firstElementChild?.remove();
  }
}

function required<T extends Element = HTMLElement>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`頁面缺少必要元素 ${selector}`);
  return found;
}
