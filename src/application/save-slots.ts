import { dateLabel } from '../domain/calendar';
import type { SaveRecord, SaveRepository } from './ports';
import { farmRating, type RatingSource } from './rating';

/**
 * 存檔槽（M7）：三個槽位各自一份存檔，列表、刪除、匯出與匯入的規則都在這裡。
 * 驗證與遷移由組裝點注入（parse），這個檔案不依賴 infrastructure。
 */

export const SAVE_SLOTS = ['slot-1', 'slot-2', 'slot-3'] as const;
export type SaveSlotId = (typeof SAVE_SLOTS)[number];

export function isSaveSlot(value: string | null): value is SaveSlotId {
  return value !== null && (SAVE_SLOTS as readonly string[]).includes(value);
}

/** 網址的 `?slot=` 決定開哪一個槽位；沒有或不合法時回到第一格。 */
export function slotFromQuery(search: string): SaveSlotId {
  const value = new URLSearchParams(search).get('slot');
  return isSaveSlot(value) ? value : SAVE_SLOTS[0];
}

/** 玩家看到的槽位名稱，例如「存檔 2」。 */
export function slotLabel(slot: string): string {
  const number = SAVE_SLOTS.indexOf(slot as SaveSlotId) + 1;
  return number > 0 ? `存檔 ${number}` : slot;
}

/** 槽位列表的一列（只讀，由存檔內容算出）。 */
export type SlotSummary =
  | { slot: string; status: 'empty' }
  | { slot: string; status: 'broken'; message: string }
  | {
      slot: string;
      status: 'ready';
      playerName: string;
      generation: number;
      dateText: string;
      gold: number;
      grade: string;
      savedAt: string;
      /** 寫入這份存檔的版本號；舊存檔沒有就是 null。 */
      gameVersion: string | null;
    };

/** 槽位列上的動作。 */
export type SlotAction = 'load' | 'export' | 'new' | 'delete' | 'import';

/**
 * 這個槽位現在能做的事。規則：
 * - 正在玩的槽位不能「讀取」自己；
 * - 損毀的槽位不能「讀取」「匯出」或「新遊戲」（新遊戲會覆寫原檔），只能「刪除」或「匯入」（匯入前會再確認）；
 * - 空白的槽位沒有東西可以刪除或匯出。
 */
export function slotActions(summary: SlotSummary, isCurrent: boolean): SlotAction[] {
  if (summary.status === 'broken') return ['delete', 'import'];
  if (summary.status === 'empty') return isCurrent ? ['import'] : ['new', 'import'];
  const others: SlotAction[] = isCurrent ? [] : ['load'];
  return [...others, 'export', 'new', 'delete', 'import'];
}

export function summarizeRecord(slot: string, record: SaveRecord, rating: RatingSource): SlotSummary {
  const { state } = record;
  return {
    slot,
    status: 'ready',
    playerName: state.playerName,
    generation: state.generation,
    dateText: dateLabel(state.calendar),
    gold: state.gold,
    grade: farmRating(state, rating).grade,
    savedAt: record.savedAt,
    gameVersion: record.gameVersion ?? null,
  };
}

/** 匯出檔的檔名：含槽位與日期（本地時間），例如 dewhollow-farm-slot-2-2026-10-22.json。 */
export function exportFileName(slot: string, date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `dewhollow-farm-${slot}-${year}-${month}-${day}.json`;
}

export interface SaveSlotDeps {
  repository: SaveRepository;
  /** 驗證並遷移一份存檔紀錄（與讀取存檔同一套規則）；不合法時拋出可讀的錯誤。 */
  parse: (raw: unknown) => SaveRecord;
  /** 評級需要的內容（與 HUD、床邊公告共用）。 */
  rating: RatingSource;
  /** 目前遊戲的版本號，寫入匯出檔與匯入後的存檔。 */
  gameVersion: string;
}

export class SaveSlotService {
  constructor(private readonly deps: SaveSlotDeps) {}

  /** 三個槽位的摘要。損毀的槽位只回報錯誤，不改動原檔。 */
  async list(): Promise<SlotSummary[]> {
    const summaries: SlotSummary[] = [];
    for (const slot of SAVE_SLOTS) {
      try {
        const record = await this.deps.repository.load(slot);
        summaries.push(record ? summarizeRecord(slot, record, this.deps.rating) : { slot, status: 'empty' });
      } catch (error) {
        summaries.push({ slot, status: 'broken', message: describe(error) });
      }
    }
    return summaries;
  }

  async remove(slot: string): Promise<void> {
    await this.deps.repository.delete(slot);
  }

  /** 匯出目前槽位的存檔：檔案內容是版本號、槽位、存檔時間與遊戲狀態，沒有其他資料。 */
  async exportSlot(slot: string, date: Date): Promise<{ fileName: string; text: string }> {
    const record = await this.deps.repository.load(slot);
    if (!record) throw new Error(`${slotLabel(slot)}沒有存檔，無法匯出`);
    const file = { slot, savedAt: record.savedAt, gameVersion: this.deps.gameVersion, state: record.state };
    return { fileName: exportFileName(slot, date), text: JSON.stringify(file, null, 2) };
  }

  /** 讀取並驗證匯入的檔案，但不寫入任何東西；失敗時拋出可讀的錯誤。 */
  async readImport(text: string): Promise<SaveRecord> {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error('這個檔案不是有效的 JSON，無法匯入');
    }
    return this.deps.parse(raw);
  }

  /** 把已驗證的存檔寫入指定槽位（會覆蓋該槽位），版本號改為目前的遊戲版本。 */
  async importRecord(slot: string, record: SaveRecord): Promise<void> {
    await this.deps.repository.save({
      slot,
      savedAt: record.savedAt,
      state: record.state,
      gameVersion: this.deps.gameVersion,
    });
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
