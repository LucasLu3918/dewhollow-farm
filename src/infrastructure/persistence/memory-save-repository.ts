import type { SaveRecord, SaveRepository } from '../../application/ports';

/** 記憶體存檔：供測試與 IndexedDB 無法使用時的明確降級，不會假裝已寫入磁碟。 */
export class MemorySaveRepository implements SaveRepository {
  private readonly records = new Map<string, SaveRecord>();

  async load(slot: string): Promise<SaveRecord | null> {
    const found = this.records.get(slot);
    return found ? structuredClone(found) : null;
  }

  async save(record: SaveRecord): Promise<void> {
    this.records.set(record.slot, structuredClone(record));
  }
}
