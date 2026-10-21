import type { GameState } from '../domain/game-state';
import type { Command } from '../application/game-commands';
import type { ContentIndex } from '../application/content-index';
import { festivalHere } from '../application/festival';
import { residentsOn } from '../application/residents';
import { CROWN_RECIPE, doneThisYear, festivalKey, openFestival, type FestivalDef } from '../domain/festival';
import { countOf } from '../domain/inventory';
import { SEASON_NAMES } from '../domain/calendar';

/**
 * 節慶告示的面板（DOM）：今天的節慶、種子交換、花冠製作、釣魚比賽的進度。
 * 能不能做、做了會怎樣都在應用層與 domain；這裡只呈現狀態並送出指令。
 */
export class FestivalPanel {
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly list: HTMLElement;
  private open_ = false;

  constructor(
    doc: Document,
    private readonly index: ContentIndex,
    private readonly onCommand: (command: Command) => void,
  ) {
    this.doc = doc;
    this.root = required(doc, '#festival-panel');
    this.summary = required(doc, '#festival-summary');
    this.list = required(doc, '#festival-list');
    required(doc, '#festival-close').addEventListener('click', () => this.close());
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
    this.list.replaceChildren();
    const here = festivalHere(state, this.index);
    const open = openFestival(this.index.festivals, state.calendar);
    this.summary.textContent = this.summaryText(state, open, here);
    if (!here) {
      this.heading('今天');
      this.item('這裡沒有進行中的節慶。');
      this.schedule();
      return;
    }
    if (here.swaps) this.swapSection(state, here);
    if (here.crown) this.crownSection(state, here);
    if (here.contest) this.contestSection(state, here);
    if (here.shop) this.heading('夜市攤位：到廣場右下角的櫃檯（攤位）買，每項有限量。');
    if (here.stars) this.heading('釣星星：到廣場左上角的水池前甩竿（按 X），等星星經過時再按 X 收網。');
  }

  private summaryText(state: GameState, open: FestivalDef | null, here: FestivalDef | null): string {
    const clock = (def: FestivalDef) => (def.fromMinute > 0 ? `晚上 ${String(Math.floor(def.fromMinute / 60)).padStart(2, '0')}:00 之後` : '整天');
    if (here) return `${here.name}今天在這裡舉行（${clock(here)}）。每項活動每年一次。`;
    if (open) return `${open.name}正在進行，請到${this.index.map(open.mapId).name}。`;
    return '節慶只在指定的日子開放。';
  }

  /** 沒有節慶時列出每個節慶的日子與時段。 */
  private schedule(): void {
    this.heading('節慶日程');
    for (const def of this.index.festivals) {
      const when = `${SEASON_NAMES[def.season]} ${def.day} 天${def.fromMinute > 0 ? '，晚上' : '，白天'}`;
      this.item(`${def.name}：${when}，在${this.index.map(def.mapId).name}`);
    }
  }

  private swapSection(state: GameState, festival: FestivalDef): void {
    this.heading('種子交換：居民要在廣場上（看他的行程）才能換，每人每年一次。');
    const present = new Set(residentsOn(state, this.index).map((r) => r.npcId));
    for (const swap of festival.swaps ?? []) {
      const npc = this.index.npc(swap.npcId);
      const give = `${this.index.item(swap.give.itemId).name} × ${swap.give.count}`;
      const receive = `${this.index.item(swap.receive.itemId).name} × ${swap.receive.count}`;
      const done = doneThisYear(state.festival, festivalKey(festival.id, 'swap', swap.npcId), state.calendar.year);
      const text = `${npc.name}：給出 ${give}，換 ${receive}${present.has(swap.npcId) ? '' : '（現在不在廣場）'}`;
      this.item(text, done ? { label: '今年已換', disabled: true } : { label: '交換', onClick: () => this.onCommand({ type: 'festivalSwap', npcId: swap.npcId }) });
    }
  }

  private crownSection(state: GameState, festival: FestivalDef): void {
    const recipe = this.index.craftingRecipe(CROWN_RECIPE);
    const need = Object.entries(recipe.ingredients)
      .map(([itemId, count]) => `${this.index.item(itemId).name} × ${count}（有 ${countOf(state.inventory, itemId)}）`)
      .join('、');
    const first = !doneThisYear(state.festival, festivalKey(festival.id, 'crown'), state.calendar.year);
    this.heading('花冠製作');
    this.item(`需要：${need}。今年第一個有 ${festival.crown?.gold ?? 0} 金的獎勵。`, { label: '做一個花冠', onClick: () => this.onCommand({ type: 'festivalCrown' }) });
    if (!first) this.item('今年的獎勵已經領過了。');
  }

  private contestSection(state: GameState, festival: FestivalDef): void {
    const rules = festival.contest;
    if (!rules) return;
    const caught = state.festival.contest.year === state.calendar.year ? state.festival.contest.caught : 0;
    this.heading('釣魚比賽：在湖邊釣魚，今天釣到的魚都算。');
    this.item(`已釣到 ${Math.min(caught, rules.count)}/${rules.count} 條，完成獎勵 ${rules.gold} 金。`);
  }

  private heading(text: string): void {
    const item = this.doc.createElement('li');
    item.className = 'quest-heading';
    item.textContent = text;
    this.list.append(item);
  }

  private item(text: string, action?: { label: string; disabled?: boolean; onClick?: () => void }): void {
    const item = this.doc.createElement('li');
    const span = this.doc.createElement('span');
    span.textContent = text;
    item.append(span);
    if (action) {
      const button = this.doc.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      button.disabled = action.disabled === true;
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
