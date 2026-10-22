import type { GameState } from '../domain/game-state';
import { messageFor, type Command } from '../application/game-commands';
import type { ContentIndex } from '../application/content-index';
import { farmRating, type RatingSource } from '../application/rating';
import { cropPriceBonusPercent, legacyRefusal, resetRefusal } from '../domain/legacy';
import { SEASON_NAMES } from '../domain/calendar';

/**
 * 床邊的公告（DOM）：農場評級、豐收重置與傳承。
 * 規則（能不能做、為什麼不能做）在 domain 與應用層；這裡只呈現狀態與文字，並把確認後的指令送出。
 * 兩個動作都要按兩次：第一次只顯示說明與「再按一次確認」，第二次才送出指令，避免誤觸。
 */
export class LegacyPanel {
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly list: HTMLElement;
  private open_ = false;
  /** 正在等待第二次確認的動作（畫面狀態，不是遊戲狀態）。 */
  private pending: 'reset' | 'legacy' | null = null;
  /** 傳承時輸入的新名字（關掉面板前保留）。 */
  private nameDraft: string | null = null;
  private readonly ratingSource: RatingSource;

  constructor(
    doc: Document,
    private readonly index: ContentIndex,
    private readonly onCommand: (command: Command) => void,
  ) {
    this.doc = doc;
    this.root = required(doc, '#legacy-panel');
    this.summary = required(doc, '#legacy-summary');
    this.list = required(doc, '#legacy-list');
    this.ratingSource = {
      rating: index.rating,
      dexCategories: index.dexCategories,
      npcIds: index.npcs.map((n) => n.id),
      friendship: index.friendship,
    };
    required(doc, '#legacy-close').addEventListener('click', () => this.close());
  }

  isOpen(): boolean {
    return this.open_;
  }

  open(state: GameState): void {
    this.open_ = true;
    this.pending = null;
    this.root.hidden = false;
    this.render(state);
  }

  refresh(state: GameState): void {
    if (this.open_) this.render(state);
  }

  close(): void {
    this.open_ = false;
    this.pending = null;
    this.root.hidden = true;
  }

  private render(state: GameState): void {
    const text = this.index.legacy;
    const rating = farmRating(state, this.ratingSource);
    const percent = (value: number) => `${Math.round(value * 100)}%`;
    this.summary.textContent =
      `${text.notice.text}　${state.playerName} 的農場（第 ${state.generation} 代）：${SEASON_NAMES[state.calendar.season]}、第 ${state.calendar.year} 年。` +
      `目前評級 ${rating.grade}（收入 ${percent(rating.parts.income)}、圖鑑 ${percent(rating.parts.collection)}、好感 ${percent(rating.parts.friendship)}）。` +
      `本年收入 ${state.yearlyIncome} 金，上一年 ${state.previousYearIncome} 金。`;

    this.list.replaceChildren();
    this.resetSection(state);
    this.legacySection(state);
  }

  private resetSection(state: GameState): void {
    const rules = this.index.legacy.reset;
    const bonus = cropPriceBonusPercent(state.resetBonus, rules);
    this.heading(`${rules.menu}（已做 ${state.resetBonus}/${rules.maxResets} 次，作物售價 +${bonus}%）`);
    const refusal = resetRefusal(state, rules);
    if (refusal === 'RESET_CLOSED') return this.item(rules.closed);
    if (refusal === 'RESET_LIMIT') return this.item(rules.limit);

    this.item(rules.warning);
    const confirming = this.pending === 'reset';
    this.item(confirming ? rules.armed : rules.hint, {
      label: confirming ? rules.confirm : rules.menu,
      onClick: () => {
        if (!confirming) {
          this.pending = 'reset';
          this.render(state);
          return;
        }
        this.pending = null;
        this.onCommand({ type: 'harvestReset', confirmed: true });
      },
    });
    if (confirming) this.item('', { label: '先不做', onClick: () => this.cancel(state) });
  }

  private legacySection(state: GameState): void {
    const rules = this.index.legacy.legacy;
    this.heading(rules.menu);
    if (legacyRefusal(state, this.index.legacy)) {
      return this.item(rules.locked.replace('{chapter}', String(rules.requiresChapter)));
    }

    this.item(rules.warning);
    const input = this.doc.createElement('input');
    input.type = 'text';
    input.maxLength = 8;
    input.value = this.nameDraft ?? state.playerName;
    input.setAttribute('aria-label', rules.nameLabel);
    input.addEventListener('input', () => {
      this.nameDraft = input.value;
    });
    const label = this.doc.createElement('li');
    const span = this.doc.createElement('span');
    span.textContent = `${rules.nameLabel}：`;
    label.append(span, input);
    this.list.append(label);

    const confirming = this.pending === 'legacy';
    this.item(confirming ? rules.armed : rules.hint, {
      label: confirming ? rules.confirm : rules.menu,
      onClick: () => {
        if (!confirming) {
          this.pending = 'legacy';
          this.render(state);
          return;
        }
        this.pending = null;
        this.nameDraft = null;
        this.onCommand({ type: 'legacy', name: input.value, confirmed: true });
      },
    });
    if (confirming) this.item('', { label: '先不做', onClick: () => this.cancel(state) });
  }

  private cancel(state: GameState): void {
    this.pending = null;
    this.render(state);
  }

  private heading(text: string): void {
    const item = this.doc.createElement('li');
    item.className = 'quest-heading';
    item.textContent = text;
    this.list.append(item);
  }

  private item(text: string, action?: { label: string; disabled?: boolean; reason?: string | null; onClick?: () => void }): void {
    const item = this.doc.createElement('li');
    if (text) {
      const span = this.doc.createElement('span');
      span.textContent = text;
      item.append(span);
    }
    if (action) {
      const button = this.doc.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      button.disabled = action.disabled === true;
      if (action.disabled && action.reason) button.title = messageFor(action.reason);
      if (action.onClick) button.addEventListener('click', action.onClick);
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
