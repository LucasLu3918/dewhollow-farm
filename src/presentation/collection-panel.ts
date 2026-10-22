import type { GameState } from '../domain/game-state';
import type { ContentIndex } from '../application/content-index';
import { categoryCount, claimKey, DEX_PERCENTS, thresholdOf, type DexCategory } from '../domain/collection';
import { conditionMet, type AchievementDef } from '../domain/achievements';
import { achievementContext } from '../application/collection';
import { PanelDialog } from './panel-dialog';

/**
 * 圖鑑與成就的面板（DOM，按 I 開關）：每一類的已發現條目與下一個門檻、七類的獎勵、成就與稱號。
 * 進度與條件判斷由 domain（collection.ts、achievements.ts）與 application/collection.ts 決定；這裡只呈現。
 * 還沒發現的條目與還沒達成的成就只顯示「？」與條件，讓玩家知道要去找什麼。
 */
export class CollectionPanel {
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly list: HTMLElement;
  private readonly dialog: PanelDialog;

  constructor(
    doc: Document,
    private readonly index: ContentIndex,
  ) {
    this.doc = doc;
    this.root = required(doc, '#collection-panel');
    this.dialog = new PanelDialog(this.root);
    this.summary = required(doc, '#collection-summary');
    this.list = required(doc, '#collection-list');
    required(doc, '#collection-close').addEventListener('click', () => this.close());
  }

  isOpen(): boolean {
    return this.dialog.isOpen();
  }

  open(state: GameState): void {
    this.render(state);
    this.dialog.open();
  }

  refresh(state: GameState): void {
    if (this.dialog.isOpen()) this.render(state);
  }

  close(): void {
    this.dialog.close();
  }

  private render(state: GameState): void {
    this.list.replaceChildren();
    const found = new Set(state.collection.found);
    const total = this.index.dexCategories.reduce((sum, c) => sum + c.entries.length, 0);
    const done = this.index.dexCategories.reduce((sum, c) => sum + categoryCount(c, state.collection.found), 0);
    const unlocked = state.achievements.unlocked.length;
    this.summary.textContent = `圖鑑 ${done}/${total} 條目 · 成就 ${unlocked}/${this.index.achievements.length} · 圖鑑碎片 ${state.dexFragments}（委託的獎勵，不計入圖鑑）`;

    this.heading('稱號');
    this.item(state.achievements.titles.length > 0 ? state.achievements.titles.join('、') : '還沒有稱號。達成成就或圖鑑門檻會得到稱號。');

    for (const category of this.index.dexCategories) this.categorySection(state, category, found);

    this.heading('成就');
    const ctx = achievementContext(state, this.index);
    for (const def of this.index.achievements) this.achievementRow(state, def, conditionMet(def.condition, ctx));
  }

  private categorySection(state: GameState, category: DexCategory, found: Set<string>): void {
    const count = categoryCount(category, state.collection.found);
    const next = DEX_PERCENTS.find((p) => count < thresholdOf(category.entries.length, p));
    const hint = next === undefined ? '全部門檻已達成' : `下一個門檻 ${next}%（${thresholdOf(category.entries.length, next)} 種）`;
    this.heading(`${category.name}：${count}/${category.entries.length}（${hint}）`);
    const names = category.entries.map((id) => (found.has(id) ? this.nameOf(id) : '？'));
    this.item(names.join('、'));
    const claimed = category.rewards.filter((r) => state.collection.claimed.includes(claimKey(category.id, r.percent)));
    if (claimed.length > 0) this.item(`已領：${claimed.map((r) => `${r.percent}%`).join('、')}`);
  }

  private achievementRow(state: GameState, def: AchievementDef, met: boolean): void {
    const unlocked = state.achievements.unlocked.includes(def.id);
    const status = unlocked ? '已達成' : met ? '可以領了' : '未達成';
    const reward = [def.reward.gold ? `${def.reward.gold} 金` : '', def.reward.title ? `稱號「${def.reward.title}」` : ''].filter(Boolean).join('、');
    this.item(`${def.name}（${status}）：${def.description}${reward ? `（獎勵：${reward}）` : ''}`);
  }

  private nameOf(id: string): string {
    return id.startsWith('animal.') ? this.index.animal(id.slice('animal.'.length)).name : this.index.item(id).name;
  }

  private heading(text: string): void {
    const item = this.doc.createElement('li');
    item.className = 'quest-heading';
    item.textContent = text;
    this.list.append(item);
  }

  private item(text: string): void {
    const item = this.doc.createElement('li');
    const span = this.doc.createElement('span');
    span.textContent = text;
    item.append(span);
    this.list.append(item);
  }
}

function required<T extends Element = HTMLElement>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`頁面缺少必要元素 ${selector}`);
  return found;
}
