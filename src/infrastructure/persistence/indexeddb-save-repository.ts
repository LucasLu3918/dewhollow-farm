import Dexie, { type Table } from 'dexie';
import type { SaveRecord, SaveRepository } from '../../application/ports';
import type { MigrationContext } from './save-migrations';
import { parseSaveRecord } from './save-schema';

class FarmDatabase extends Dexie {
  saves!: Table<SaveRecord, string>;

  constructor() {
    super('dewhollow-farm');
    this.version(1).stores({ saves: 'slot' });
  }
}

/**
 * IndexedDB 存檔。讀取時一律重新驗證格式，損毀的存檔會回報錯誤而不是載入半殘狀態。
 * 所有錯誤原樣拋出，由 UI 顯示真實原因。
 */
export class IndexedDbSaveRepository implements SaveRepository {
  private readonly db = new FarmDatabase();

  constructor(private readonly migration: MigrationContext) {}

  async load(slot: string): Promise<SaveRecord | null> {
    const raw = await this.db.saves.get(slot);
    if (!raw) return null;
    return parseSaveRecord(raw, this.migration);
  }

  async save(record: SaveRecord): Promise<void> {
    await this.db.transaction('rw', this.db.saves, async () => {
      await this.db.saves.put(structuredClone(record));
    });
  }
}

/** 瀏覽器是否提供 IndexedDB；不提供時由組裝點決定降級方式。 */
export function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}
