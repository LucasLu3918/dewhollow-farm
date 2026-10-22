import type { ContentPack } from '../domain/content';
import { dateLabel, formatClock } from '../domain/calendar';
import type { GameState } from '../domain/game-state';
import { TOOL_NAMES, type ToolId } from '../domain/tools';
import { levelOf, SKILL_IDS, SKILL_NAMES } from '../domain/skills';
import { WEATHER_NAMES } from '../domain/weather';
import { pendingTalentSkills } from './skill-panel';
import { farmRating } from '../application/rating';
import { NO_RATING } from '../domain/rating';
import { mineStatusLabel } from './mine-status';
import { levelMarker } from './accessibility';

const LOG_LIMIT = 6;

/** DOM 版 HUD：只負責把狀態呈現到頁面上，不含任何規則。 */
export class Hud {
  private readonly doc: Document;
  private colorblind = false;
  private readonly clock: HTMLElement;
  private readonly day: HTMLElement;
  private readonly weather: HTMLElement;
  private readonly skills: HTMLElement;
  private readonly gold: HTMLElement;
  private readonly rating: HTMLElement;
  private readonly energyFill: HTMLElement;
  private readonly energyText: HTMLElement;
  private readonly tool: HTMLElement;
  private readonly seed: HTMLElement;
  private readonly mine: HTMLElement;
  private readonly version: HTMLElement;
  private readonly log: HTMLElement;

  constructor(doc: Document) {
    this.doc = doc;
    this.clock = required(doc, '#hud-clock');
    this.day = required(doc, '#hud-day');
    this.weather = required(doc, '#hud-weather');
    this.skills = required(doc, '#hud-skills');
    this.gold = required(doc, '#hud-gold');
    this.rating = required(doc, '#hud-rating');
    this.energyFill = required(doc, '#hud-energy-fill');
    this.energyText = required(doc, '#hud-energy-text');
    this.tool = required(doc, '#hud-tool');
    this.seed = required(doc, '#hud-seed');
    this.mine = required(doc, '#hud-mine');
    this.version = required(doc, '#hud-version');
    this.log = required(doc, '#hud-log');
  }

  /** 狀態列上的版本號（例如 v0.1.0）；點了說明頁可看到完整的更新日誌。 */
  setVersion(version: string): void {
    this.version.textContent = `v${version}`;
  }

  update(state: GameState, pack: ContentPack): void {
    this.clock.textContent = formatClock(state.calendar);
    this.day.textContent = dateLabel(state.calendar);
    this.weather.textContent = `${WEATHER_NAMES[state.weather]}　明天：${WEATHER_NAMES[state.forecast]}`;
    this.gold.textContent = `${state.gold} 金`;
    const grade = farmRating(state, {
      rating: pack.rating ?? NO_RATING,
      dexCategories: pack.collection ?? [],
      npcIds: pack.npcs.map((n) => n.id),
      friendship: pack.friendship,
    });
    this.rating.textContent = `評級 ${grade.grade}`;
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

  /** 狀態列的「說明」與「存檔」按鈕（鍵盤的 ? 與 L 也一樣）。 */
  bindDialogs(onHelp: () => void, onSaves: () => void): void {
    required(this.doc, '#hud-help').addEventListener('click', onHelp);
    required(this.doc, '#hud-saves').addEventListener('click', onSaves);
  }

  /** 有新版本可用時顯示更新按鈕；按下後才套用（先存檔，見 service-worker.ts），不會自動打斷遊戲。 */
  showUpdate(onApply: () => void): void {
    const button = required<HTMLButtonElement>(this.doc, '#hud-update');
    button.hidden = false;
    button.addEventListener('click', onApply, { once: true });
  }

  /** 狀態列的「設定」按鈕（鍵盤的 O 也一樣）。 */
  bindSettings(onOpen: () => void): void {
    required(this.doc, '#hud-settings').addEventListener('click', onOpen);
  }

  /** 色盲模式：訊息前面加上 ✕ 或 ✓ 的文字標記（見 accessibility.ts）。 */
  setColorblind(on: boolean): void {
    this.colorblind = on;
  }

  messages(lines: readonly string[]): void {
    for (const line of lines) this.append(line, 'info');
  }

  error(message: string): void {
    this.append(message, 'error');
  }

  private append(text: string, level: 'info' | 'error'): void {
    const item = document.createElement('li');
    item.textContent = levelMarker(level, this.colorblind) + text;
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
