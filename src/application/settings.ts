import type { Settings } from '../domain/settings';

/**
 * 偏好設定的儲存埠（port）。與存檔（SaveRepository）分開：偏好不進存檔，清掉偏好不影響進度。
 * 實作（localStorage）負責 JSON 格式與 schemaVersion；讀取一律回傳完整的 Settings（讀不到就是預設值），
 * 寫入失敗回傳 false 而不丟例外，遊戲照常進行。
 */
export interface SettingsStore {
  get(): Settings;
  set(settings: Settings): boolean;
}

export type SettingsListener = (settings: Settings) => void;

/**
 * 偏好的服務：保存目前的偏好、寫入儲存埠，並通知訂閱者（例如套用字級與色盲模式的 DOM）。
 */
export class SettingsService {
  private current: Settings;
  private readonly listeners = new Set<SettingsListener>();

  constructor(private readonly store: SettingsStore) {
    this.current = store.get();
  }

  get(): Settings {
    return this.current;
  }

  /**
   * 合併一部分偏好，寫入儲存埠，然後通知訂閱者。
   * 回傳是否寫入成功；寫入失敗時目前這一次的偏好仍然生效（只是重新整理後會回到上次成功的值）。
   */
  update(patch: Partial<Settings>): boolean {
    this.current = { ...this.current, ...patch };
    const saved = this.store.set(this.current);
    for (const listener of this.listeners) listener(this.current);
    return saved;
  }

  onChange(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
