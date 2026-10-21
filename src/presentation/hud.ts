import type { ContentPack } from '../domain/content';
import { dateLabel, formatClock } from '../domain/calendar';
import type { GameState } from '../domain/game-state';
import { TOOL_NAMES, type ToolId } from '../domain/tools';
import { levelOf, SKILL_IDS, SKILL_NAMES } from '../domain/skills';
import { WEATHER_NAMES } from '../domain/weather';
import { pendingTalentSkills } from './skill-panel';
import { mineStatusLabel } from './mine-status';

const LOG_LIMIT = 6;

/** DOM 版 HUD：只負責把狀態呈現到頁面上，不含任何規則。 */
export class Hud {
  private readonly clock: HTMLElement;
  private readonly day: HTMLElement;
  private readonly weather: HTMLElement;
  private readonly skills: HTMLElement;
  private readonly gold: HTMLElement;
  private readonly energyFill: HTMLElement;
  private readonly energyText: HTMLElement;
  private readonly tool: HTMLElement;
  private readonly seed: HTMLElement;
  private readonly mine: HTMLElement;
  private readonly log: HTMLElement;

  constructor(doc: Document) {
    this.clock = required(doc, '#hud-clock');
    this.day = required(doc, '#hud-day');
    this.weather = required(doc, '#hud-weather');
    this.skills = required(doc, '#hud-skills');
    this.gold = required(doc, '#hud-gold');
    this.energyFill = required(doc, '#hud-energy-fill');
    this.energyText = required(doc, '#hud-energy-text');
    this.tool = required(doc, '#hud-tool');
    this.seed = required(doc, '#hud-seed');
    this.mine = required(doc, '#hud-mine');
    this.log = required(doc, '#hud-log');
  }

  update(state: GameState, pack: ContentPack): void {
    this.clock.textContent = formatClock(state.calendar);
    this.day.textContent = dateLabel(state.calendar);
    this.weather.textContent = `${WEATHER_NAMES[state.weather]}　明天：${WEATHER_NAMES[state.forecast]}`;
    this.gold.textContent = `${state.gold} 金`;
    const pending = pendingTalentSkills(state, pack.tuning.skills.thresholds, pack.talents).length;
    const levels = SKILL_IDS.map((id) => `${SKILL_NAMES[id]} ${levelOf(state.skills[id], pack.tuning.skills.thresholds)}`).join('　');
    this.skills.textContent = pending > 0 ? `${levels}　（有 ${pending} 項可選天賦）` : levels;
    const ratio = Math.max(0, Math.min(1, state.energy.current / (state.energy.max || 1)));
    this.energyFill.style.width = `${Math.round(ratio * 100)}%`;
    this.energyText.textContent = `${state.energy.current} / ${state.energy.max}`;
    this.tool.textContent = TOOL_NAMES[state.tool];
    const crop = pack.crops.find((c) => c.id === state.selectedSeed);
    this.seed.textContent = state.tool === 'seedbag' ? `種子：${crop?.name ?? state.selectedSeed}` : '';
    this.mine.textContent = mineStatusLabel(state);
  }

  /** 點技能列就打開技能與天賦面板（鍵盤的 K 也一樣）。 */
  bindSkills(onOpen: () => void): void {
    this.skills.addEventListener('click', onOpen);
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
