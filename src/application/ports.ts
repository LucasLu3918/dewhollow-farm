import type { GameState } from '../domain/game-state';

/** 一筆存檔紀錄。 */
export interface SaveRecord {
  slot: string;
  savedAt: string;
  state: GameState;
}

/**
 * 存檔埠（port）：應用層只依賴此介面。
 * 實作可為 IndexedDB、記憶體（測試）或之後的匯入匯出。
 */
export interface SaveRepository {
  load(slot: string): Promise<SaveRecord | null>;
  save(record: SaveRecord): Promise<void>;
}
