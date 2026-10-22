import type { GameState } from '../domain/game-state';
import { TIER_NAMES, TOOL_NAMES, type ToolId } from '../domain/tools';
import { countOf } from '../domain/inventory';
import { messageFor, type Command } from '../application/game-commands';
import type { ContentIndex } from '../application/content-index';
import { buyRefusal, missingMaterials, upgradeRecipe, upgradeRefusal } from '../application/purchase-check';
import type { ToolUpgrade } from '../domain/content';
import { onSale } from '../domain/shop-stock';
import { boughtThisWeek, merchantOpen, weekStock } from '../domain/traveling-merchant';
import { levelMarker } from './accessibility';
import { PanelDialog } from './panel-dialog';

/** 每一列的按鈕：可見文字、螢幕閱讀器讀的名稱、拒絕原因（null 表示可以按）。 */
interface RowAction {
  text: string;
  name: string;
  reason: string | null;
  onClick: () => void;
}

/**
 * 商店面板（DOM）：只負責把貨架與升級項目列出來，按鈕送出指令；
 * 價格、金幣、材料與是否能買，都由應用層的 purchase-check.ts 判斷（這裡只呈現原因）。
 * 無法買的列按鈕停用，並把原因寫在列裡（aria-describedby 連到原因）。
 * 買或升級的結果由 MapScene 透過 showMessage 送到面板內的結果行。
 */
export class ShopPanel {
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly funds: HTMLElement;
  private readonly result: HTMLElement;
  private readonly list: HTMLElement;
  private readonly dialog: PanelDialog;
  private shopId: string | null = null;
  private reasonSeq = 0;

  constructor(
    doc: Document,
    private readonly index: ContentIndex,
    private readonly onCommand: (command: Command) => void,
  ) {
    this.doc = doc;
    this.root = required(doc, '#shop-panel');
    this.dialog = new PanelDialog(this.root);
    this.title = required(doc, '#shop-title');
    this.funds = required(doc, '#shop-funds');
    this.result = required(doc, '#shop-result');
    this.list = required(doc, '#shop-list');
    required(doc, '#shop-close').addEventListener('click', () => this.close());
  }

  isOpen(): boolean {
    return this.dialog.isOpen();
  }

  open(shopId: string, state: GameState): void {
    this.shopId = shopId;
    this.showMessage('', false);
    this.render(state);
    this.dialog.open();
  }

  /** 每次指令之後重新畫一次，金幣與貨架才會是最新的。 */
  refresh(state: GameState): void {
    if (this.shopId !== null) this.render(state);
  }

  close(): void {
    this.shopId = null;
    this.dialog.close();
  }

  /** 買或升級的結果（或被拒絕的原因）。isError 為真時用錯誤樣式；色盲模式下前面加 ✕ / ✓ 標記。 */
  showMessage(text: string, isError: boolean): void {
    const colorblind = this.doc.documentElement.dataset.colorblind === 'on';
    this.result.textContent = text === '' ? '' : levelMarker(isError ? 'error' : 'info', colorblind) + text;
    this.result.classList.toggle('error', isError);
  }

  private render(state: GameState): void {
    if (this.shopId === null) return;
    const shop = this.index.shop(this.shopId);
    this.title.textContent = shop.name;
    this.funds.textContent = `你的金幣：${state.gold}　木材：${countOf(state.inventory, 'wood')}　銅礦石：${countOf(state.inventory, 'copper-ore')}`;
    this.list.replaceChildren();

    if (shop.rotating) {
      this.renderMerchant(state, shop.id);
    } else if (shop.stock.length > 0) {
      for (const line of shop.stock) {
        // 季節進貨：這個季節沒有進貨的東西不列出（見 shops.json 的 seasons、domain/shop-stock.ts）。
        if (!onSale(line, state.calendar.season)) continue;
        const name = this.nameOf(line.itemId);
        this.addRow(`${name}　${line.price} 金`, {
          text: '買一個',
          name: `買 ${name}`,
          reason: reasonText(buyRefusal(state, this.index, shop.id, line.itemId, 1)),
          onClick: () => this.onCommand({ type: 'buy', shopId: shop.id, itemId: line.itemId, count: 1 }),
        });
      }
    }

    // 鐵匠：每件工具只列出下一階的升級。
    for (const tool of Object.keys(state.toolTiers) as ToolId[]) {
      const recipe = upgradeRecipe(state, this.index, shop.id, tool);
      if (!recipe) continue;
      const next = state.toolTiers[tool] + 1;
      const materials = Object.entries(recipe.items)
        .map(([itemId, count]) => `${this.index.item(itemId).name} × ${count}`)
        .join('、');
      this.addRow(`${TOOL_NAMES[tool]} → ${TIER_NAMES[next]}級　${recipe.gold} 金、${materials}`, {
        text: '升級',
        name: `升級 ${TOOL_NAMES[tool]} 到 ${TIER_NAMES[next]}級`,
        reason: this.upgradeReason(state, recipe, upgradeRefusal(state, this.index, shop.id, tool)),
        onClick: () => this.onCommand({ type: 'upgrade', shopId: shop.id, toolId: tool }),
      });
    }

    if (this.list.childElementCount === 0) {
      const empty = this.doc.createElement('li');
      empty.textContent = '目前沒有可以買或可以升級的東西';
      this.list.append(empty);
    }
  }

  /**
   * 旅行商人：週五、六才有貨架（這一週的貨，見 domain/traveling-merchant.ts）；每件顯示本週還可以買幾個。
   * 能不能買、買幾個，都由應用層判斷，這裡只列出來。
   */
  private renderMerchant(state: GameState, shopId: string): void {
    const rules = this.index.merchant;
    const daysPerSeason = this.index.tuning.time.daysPerSeason;
    if (!rules || !merchantOpen(rules, state.calendar, daysPerSeason)) {
      const note = this.doc.createElement('li');
      note.textContent = '旅行商人只在週五、週六的鎮廣場出現';
      this.list.append(note);
      return;
    }
    const bought = boughtThisWeek(state.merchant, state.calendar, daysPerSeason);
    for (const line of weekStock(rules, state.calendar, daysPerSeason)) {
      const left = rules.perItemWeekly - (bought[line.itemId] ?? 0);
      const name = this.nameOf(line.itemId);
      this.addRow(`${name}　${line.price} 金（本週還可買 ${left} 個）`, {
        text: '買一個',
        name: `買 ${name}`,
        reason: reasonText(buyRefusal(state, this.index, shopId, line.itemId, 1)),
        onClick: () => this.onCommand({ type: 'buy', shopId, itemId: line.itemId, count: 1 }),
      });
    }
  }

  /** 升級的原因；材料不夠時把還缺的列出來（與指令的訊息格式相同）。 */
  private upgradeReason(state: GameState, recipe: ToolUpgrade, refusal: string | null): string | null {
    if (refusal === null) return null;
    if (refusal !== 'NO_MATERIAL') return messageFor(refusal);
    return `${messageFor(refusal)}：還差 ${missingMaterials(state, this.index, recipe.items).join('、')}`;
  }

  /** 貨架上的名稱：動物（animal.<id>）用動物的名字，其餘查物品表。 */
  private nameOf(itemId: string): string {
    return itemId.startsWith('animal.') ? this.index.animal(itemId.slice('animal.'.length)).name : this.index.item(itemId).name;
  }

  private addRow(label: string, action: RowAction): void {
    const item = this.doc.createElement('li');
    const text = this.doc.createElement('span');
    text.textContent = label;
    const button = this.doc.createElement('button');
    button.type = 'button';
    button.textContent = action.text;
    button.setAttribute('aria-label', action.name);
    item.append(text, button);
    if (action.reason !== null) {
      // 不能買：按鈕停用，原因寫在列裡，並用 aria-describedby 連到按鈕。
      const reason = this.doc.createElement('span');
      reason.className = 'shop-reason';
      reason.id = `shop-reason-${(this.reasonSeq += 1)}`;
      reason.textContent = action.reason;
      button.disabled = true;
      button.setAttribute('aria-describedby', reason.id);
      item.append(reason);
    } else {
      button.addEventListener('click', action.onClick);
    }
    this.list.append(item);
  }
}

/** 拒絕原因的文字（用指令既有的訊息）；能買時為 null。 */
function reasonText(refusal: string | null): string | null {
  return refusal === null ? null : messageFor(refusal);
}

function required<T extends Element = HTMLElement>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`頁面缺少必要元素 ${selector}`);
  return found;
}
