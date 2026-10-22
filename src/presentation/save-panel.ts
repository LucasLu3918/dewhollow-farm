import type { SaveRecord } from '../application/ports';
import { slotActions, slotLabel, type SaveSlotService, type SlotAction, type SlotSummary } from '../application/save-slots';

/**
 * 存檔槽面板（DOM）：三格存檔的列表與操作。
 * 哪些操作能做、損毀時能不能覆寫，是 application/save-slots.ts 的規則；這裡只呈現與排順序。
 * 會覆寫或刪除的操作要按兩次（第一次只顯示「再按一次」），離開目前存檔前會先存檔。
 */

export interface SavePanelOptions {
  service: SaveSlotService;
  /** 正在玩的槽位（網址的 slot）；損毀時也是這一格。 */
  currentSlot: string;
  /** 瀏覽器是否能用 IndexedDB；不能時存檔只會留在這個頁面，面板只顯示說明。 */
  persistent: boolean;
  /** 離開目前的存檔前要做的事（先存檔目前的進度）；沒有進行中的遊戲時是空動作。 */
  beforeLeave: () => Promise<void>;
  /** 換到另一格：重新載入頁面並開啟那一格。 */
  navigate: (slot: string) => void;
}

const ACTION_LABELS: Record<SlotAction, string> = {
  load: '讀取',
  export: '匯出',
  new: '新遊戲',
  delete: '刪除',
  import: '匯入',
};

/** 第一次按下時顯示的確認文字（需要確認的動作才有）。 */
const CONFIRM_LABELS: Partial<Record<SlotAction, string>> = {
  new: '再按一次：覆蓋並開新遊戲',
  delete: '再按一次：確定刪除',
  import: '再按一次：選擇檔案後覆蓋',
};

export class SavePanel {
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly list: HTMLElement;
  private readonly message: HTMLElement;
  private readonly fileInput: HTMLInputElement;
  private open_ = false;
  /** 正在等待第二次確認的動作（畫面狀態，不是遊戲狀態）。 */
  private pending: { slot: string; action: SlotAction } | null = null;
  /** 正在等待選擇匯入檔案的格子。 */
  private importTarget: string | null = null;
  private busy = false;
  private summaries: SlotSummary[] = [];

  constructor(
    doc: Document,
    private readonly options: SavePanelOptions,
  ) {
    this.doc = doc;
    this.root = required(doc, '#save-panel');
    this.list = required(doc, '#save-list');
    this.message = required(doc, '#save-message');
    required(doc, '#save-close').addEventListener('click', () => this.close());
    this.fileInput = doc.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'application/json,.json';
    this.fileInput.hidden = true;
    this.fileInput.addEventListener('change', () => void this.handleFile());
    this.root.append(this.fileInput);
  }

  isOpen(): boolean {
    return this.open_;
  }

  async open(): Promise<void> {
    this.open_ = true;
    this.root.hidden = false;
    this.pending = null;
    this.setMessage(this.options.persistent ? '' : '這個瀏覽器無法使用 IndexedDB，存檔槽不能使用。');
    await this.refresh();
  }

  close(): void {
    this.open_ = false;
    this.root.hidden = true;
    this.pending = null;
    this.importTarget = null;
  }

  private async refresh(): Promise<void> {
    this.summaries = this.options.persistent ? await this.options.service.list() : [];
    this.render();
  }

  private render(): void {
    this.list.replaceChildren();
    for (const summary of this.summaries) this.renderSlot(summary);
  }

  private renderSlot(summary: SlotSummary): void {
    const isCurrent = summary.slot === this.options.currentSlot;
    const item = this.doc.createElement('li');
    item.className = 'save-slot';

    const title = this.doc.createElement('p');
    title.className = 'save-title';
    title.textContent = `${slotLabel(summary.slot)}${isCurrent ? '（正在玩）' : ''}`;
    const detail = this.doc.createElement('p');
    detail.className = summary.status === 'broken' ? 'save-detail error' : 'save-detail';
    detail.textContent = describeSummary(summary);
    item.append(title, detail);

    const actions = this.doc.createElement('div');
    actions.className = 'save-actions';
    for (const action of slotActions(summary, isCurrent)) {
      actions.append(this.actionButton(summary, action));
    }
    if (this.pending?.slot === summary.slot) {
      const cancel = this.doc.createElement('button');
      cancel.type = 'button';
      cancel.textContent = '先不做';
      cancel.addEventListener('click', () => {
        this.pending = null;
        this.render();
      });
      actions.append(cancel);
    }
    item.append(actions);
    this.list.append(item);
  }

  private actionButton(summary: SlotSummary, action: SlotAction): HTMLButtonElement {
    const armed = this.pending?.slot === summary.slot && this.pending.action === action;
    const button = this.doc.createElement('button');
    button.type = 'button';
    button.textContent = armed ? (CONFIRM_LABELS[action] ?? ACTION_LABELS[action]) : ACTION_LABELS[action];
    button.addEventListener('click', () => void this.onAction(summary, action, armed));
    return button;
  }

  private async onAction(summary: SlotSummary, action: SlotAction, armed: boolean): Promise<void> {
    if (this.busy) return;
    if (needsConfirm(summary, action) && !armed) {
      this.pending = { slot: summary.slot, action };
      this.render();
      return;
    }
    this.pending = null;
    this.busy = true;
    try {
      await this.perform(summary, action);
    } catch (error) {
      this.setMessage(`${ACTION_LABELS[action]}失敗：${describe(error)}`, true);
      this.render();
    } finally {
      this.busy = false;
    }
  }

  private async perform(summary: SlotSummary, action: SlotAction): Promise<void> {
    const { service, currentSlot, beforeLeave, navigate } = this.options;
    const slot = summary.slot;
    const isCurrent = slot === currentSlot;
    switch (action) {
      case 'load':
        await beforeLeave();
        navigate(slot);
        return;
      case 'new':
        // 新遊戲：覆寫這一格（若有存檔）後重新載入，遊戲會在空白的格子上開始。
        if (!isCurrent) await beforeLeave();
        await service.remove(slot);
        navigate(slot);
        return;
      case 'delete':
        await service.remove(slot);
        if (isCurrent) {
          // 刪的是正在玩的這一格：重新載入，這一格就變成空白的新遊戲。
          navigate(slot);
          return;
        }
        this.setMessage(`${slotLabel(slot)}已刪除。`);
        await this.refresh();
        return;
      case 'export': {
        // 正在玩的格子先存檔，匯出的才是最新進度。
        if (isCurrent) await beforeLeave();
        const exported = await service.exportSlot(slot, new Date());
        downloadText(this.doc, exported.fileName, exported.text);
        this.setMessage(`已匯出 ${exported.fileName}`);
        return;
      }
      case 'import':
        this.importTarget = slot;
        this.fileInput.value = '';
        this.fileInput.click();
        return;
    }
  }

  /** 選好匯入的檔案：先驗證（不通過就不寫入），通過才覆寫目標格。 */
  private async handleFile(): Promise<void> {
    const file = this.fileInput.files?.[0];
    const slot = this.importTarget;
    this.importTarget = null;
    if (!file || !slot) return;
    try {
      const record: SaveRecord = await this.options.service.readImport(await file.text());
      await this.options.service.importRecord(slot, record);
      if (slot === this.options.currentSlot) {
        // 正在玩的這一格被換掉了：重新載入（不先存檔，否則會把匯入的內容蓋掉）。
        this.options.navigate(slot);
        return;
      }
      this.setMessage(`已匯入到 ${slotLabel(slot)}，按「讀取」就能開始遊玩。`);
      await this.refresh();
    } catch (error) {
      this.setMessage(`匯入失敗：${describe(error)}（原來的存檔沒有被改動）`, true);
    }
  }

  private setMessage(text: string, isError = false): void {
    this.message.textContent = text;
    this.message.className = isError ? 'save-message error' : 'save-message';
  }
}

/** 會覆寫或刪除的操作要先確認：刪除一律要，覆寫（新遊戲、匯入）只針對已有存檔的格子。 */
function needsConfirm(summary: SlotSummary, action: SlotAction): boolean {
  if (action === 'delete') return true;
  if (action === 'new' || action === 'import') return summary.status !== 'empty';
  return false;
}

function describeSummary(summary: SlotSummary): string {
  if (summary.status === 'empty') return '空白，還沒有存檔。';
  if (summary.status === 'broken') return `存檔損毀，原檔已保留：${summary.message}`;
  const saved = formatSavedAt(summary.savedAt);
  const version = summary.gameVersion ? `v${summary.gameVersion}` : '版本未知';
  return `${summary.playerName} 的農場（第 ${summary.generation} 代）　${summary.dateText}　${summary.gold} 金　評級 ${summary.grade}　存檔於 ${saved}（${version}）`;
}

function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-TW', { hour12: false });
}

function downloadText(doc: Document, fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = doc.createElement('a');
  link.href = url;
  link.download = fileName;
  doc.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function required<T extends Element = HTMLElement>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`頁面缺少必要元素 ${selector}`);
  return found;
}
