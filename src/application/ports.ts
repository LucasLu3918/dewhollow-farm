import type { GameState } from '../domain/game-state';

/**
 * 一筆存檔紀錄。`gameVersion` 是寫入這份存檔的遊戲版本號（M7）；舊存檔沒有這個欄位，視為未知，不是錯誤。
 * 它放在紀錄外層而不在 GameState 裡，所以加上它不需要升級存檔版本。
 */
export interface SaveRecord {
  slot: string;
  savedAt: string;
  state: GameState;
  gameVersion?: string;
}

/**
 * 存檔埠（port）：應用層只依賴此介面。
 * 實作可為 IndexedDB、記憶體（測試）。刪除只給存檔槽的「刪除」與「新遊戲覆蓋」使用。
 */
export interface SaveRepository {
  load(slot: string): Promise<SaveRecord | null>;
  save(record: SaveRecord): Promise<void>;
  delete(slot: string): Promise<void>;
}
