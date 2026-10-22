import type { SettingsStore } from '../../application/settings';
import { SETTINGS_SCHEMA_VERSION, defaultSettings, isFutureSettingsVersion, sanitizeSettings, type Settings } from '../../domain/settings';

/** localStorage 裡偏好的鍵。只放偏好，不放存檔。 */
export const SETTINGS_STORAGE_KEY = 'dewhollow-farm.settings';

/** 只需要讀寫字串的最小介面（方便測試時替換成假的儲存空間）。 */
export interface StringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** 取得瀏覽器的 localStorage；私密視窗或封鎖儲存時可能丟例外，此時回傳 null。 */
export function browserStorage(): StringStorage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * 偏好的 localStorage 實作：JSON 格式，帶 schemaVersion。
 * 每次讀寫都包 try/catch：讀不到、格式錯誤或儲存被封鎖時，讀取回傳預設值，寫入回傳 false，都不丟例外。
 */
export class LocalSettingsStore implements SettingsStore {
  private futureVersionReadOnly = false;

  constructor(private readonly storage: () => StringStorage | null = browserStorage) {}

  get(): Settings {
    this.futureVersionReadOnly = false;
    try {
      const storage = this.storage();
      if (!storage) return defaultSettings();
      const raw = storage.getItem(SETTINGS_STORAGE_KEY);
      if (raw === null) return defaultSettings();
      const record: unknown = JSON.parse(raw);
      this.futureVersionReadOnly = isFutureSettingsVersion(record);
      return sanitizeSettings(record);
    } catch {
      return defaultSettings();
    }
  }

  set(settings: Settings): boolean {
    try {
      const storage = this.storage();
      if (!storage) return false;
      if (this.futureVersionReadOnly) return false;

      // SettingsService reads once at construction, but also guard direct store use and external updates.
      const existing = storage.getItem(SETTINGS_STORAGE_KEY);
      if (existing !== null) {
        try {
          if (isFutureSettingsVersion(JSON.parse(existing) as unknown)) {
            this.futureVersionReadOnly = true;
            return false;
          }
        } catch {
          // Malformed data can be replaced by a valid v2 record after the player explicitly changes a setting.
        }
      }
      storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ schemaVersion: SETTINGS_SCHEMA_VERSION, settings }));
      return true;
    } catch {
      return false;
    }
  }
}
