import type { GameState } from '../domain/game-state';
import { messageFor, type Command } from '../application/game-commands';
import type { ContentIndex } from '../application/content-index';
import { festivalHere, starExchangeRefusal } from '../application/festival';
import { residentsOn } from '../application/residents';
import { CROWN_RECIPE, doneThisYear, exchangedThisYear, festivalKey, lanternKeysOf, litLanterns, openFestival, warmGiftsLeft, type FestivalDef } from '../domain/festival';
import { countOf } from '../domain/inventory';
import { SEASON_NAMES } from '../domain/calendar';
import { PanelDialog } from './panel-dialog';

/**
 * 節慶告示的面板（DOM）：今天的節慶、種子交換、花冠製作、釣魚比賽的進度。
 * 能不能做、做了會怎樣都在應用層與 domain；這裡只呈現狀態並送出指令。
 */
export class FestivalPanel {
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly list: HTMLElement;
  private readonly dialog: PanelDialog;

  constructor(
    doc: Document,
    private readonly index: ContentIndex,
    private readonly onCommand: (command: Command) => void,
  ) {
    this.doc = doc;
    this.root = required(doc, '#festival-panel');
    this.dialog = new PanelDialog(this.root);
    this.summary = required(doc, '#festival-summary');
    this.list = required(doc, '#festival-list');
    required(doc, '#festival-close').addEventListener('click', () => this.close());
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
    this.dialog.redraw(() => this.paint(state));
  }

  private paint(state: GameState): void {
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
    if (here.exchange) this.starExchangeSection(state, here);
    if (here.harvestContest) this.harvestSection(state, here);
    if (here.lanterns) this.lanternSection(state, here);
    if (here.giftExchange) this.giftSection(state, here);
  }

  /** 收成比賽：今天收成指定的作物，累計到目標就完成（數量由應用層記在 festival.harvest）。 */
  private harvestSection(state: GameState, festival: FestivalDef): void {
    const rules = festival.harvestContest;
    if (!rules) return;
    const year = state.calendar.year;
    const count = state.festival.harvest.year === year ? state.festival.harvest.count : 0;
    const done = doneThisYear(state.festival, festivalKey(festival.id, 'contest'), year);
    this.heading('收成比賽：今天收成指定的作物，累計到目標就完成獎勵。');
    this.item(`${this.index.item(`crop.${rules.cropId}`).name}：已收成 ${Math.min(count, rules.count)}/${rules.count}，完成獎勵 ${rules.gold} 金。${done ? '（今年已領過）' : ''}`);
  }

  /** 點燈：站在廣場的燈前按 X，每盞每年一次；全部點亮再有獎勵。 */
  private lanternSection(state: GameState, festival: FestivalDef): void {
    const rules = festival.lanterns;
    if (!rules) return;
    const lit = litLanterns(state.festival.done, festival.id, lanternKeysOf(this.index.map(state.mapId)), state.calendar.year);
    this.heading('點燈：到廣場上的燈前按 X，每盞每年點一次。');
    this.item(`已點亮 ${lit}/${rules.count} 盞，全部點亮再得 ${rules.allGold} 金。每盞 ${rules.gold} 金。`);
  }

  /** 交換禮物：指定的居民收禮不受每日一次限制，每年有次數，會回禮。 */
  private giftSection(state: GameState, festival: FestivalDef): void {
    const rules = festival.giftExchange;
    if (!rules) return;
    const names = rules.npcIds.map((id) => this.index.npc(id).name).join('、');
    const left = warmGiftsLeft(state.festival.exchanged, state.calendar.year, rules.perYear);
    this.heading('交換禮物：到指定的居民面前送禮（F 鍵），不受每日一次限制，會收到回禮。');
    this.item(`${names}：今年還可以送 ${left}/${rules.perYear} 次，回禮 ${this.index.item(rules.receive.itemId).name} × ${rules.receive.count}。`);
  }

  /** 星河兌換：能不能換、為什麼不能換都由應用層決定（starExchangeRefusal）；這裡只顯示。 */
  private starExchangeSection(state: GameState, festival: FestivalDef): void {
    this.heading('星河兌換：用星河碎片換限定物品或解鎖配方，每項每年有上限。碎片跨年保留。');
    for (const line of festival.exchange ?? []) {
      const give = `${this.index.item(line.give.itemId).name} × ${line.give.count}（有 ${countOf(state.inventory, line.give.itemId)}）`;
      const get = line.receive ? `換 ${this.index.item(line.receive.itemId).name} × ${line.receive.count}` : '解鎖這項配方';
      const left = Math.max(0, line.limit - exchangedThisYear(state.festival.exchanged, state.calendar.year, line.id));
      const refusal = starExchangeRefusal(state, this.index, line.id);
      const note = refusal ? `（${messageFor(refusal)}）` : '';
      this.item(`${line.name}：給出 ${give}，${get}；今年還可換 ${left} 次${note}`, {
        label: '兌換',
        disabled: refusal !== null,
        onClick: () => this.onCommand({ type: 'starExchange', lineId: line.id }),
      });
    }
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
