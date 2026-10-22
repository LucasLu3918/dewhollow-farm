import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../../domain/keybindings';
import { SETTINGS_SCHEMA_VERSION, defaultSettings } from '../../domain/settings';
import { LocalSettingsStore, SETTINGS_STORAGE_KEY } from './local-settings-store';

/** 假的 localStorage：可以指定讀或寫時丟出例外，模擬被封鎖的儲存空間。 */
function fakeStorage(initial: Record<string, string> = {}, options: { throwOnRead?: boolean; throwOnWrite?: boolean } = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    data,
    getItem(key: string): string | null {
      if (options.throwOnRead) throw new Error('SecurityError');
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      if (options.throwOnWrite) throw new Error('QuotaExceededError');
      data.set(key, value);
    },
  };
}

describe('LocalSettingsStore', () => {
  it('returns the defaults when nothing has been saved yet', () => {
    const store = new LocalSettingsStore(() => fakeStorage());
    expect(store.get()).toEqual(defaultSettings());
  });

  it('reads back what it wrote, including a custom key and the schema version', () => {
    const storage = fakeStorage();
    const store = new LocalSettingsStore(() => storage);
    const changed = { ...defaultSettings(), fontSize: 'large' as const, colorblind: true, bindings: { ...DEFAULT_BINDINGS, interact: 'e', wear: 'x' } };
    expect(store.set(changed)).toBe(true);
    const raw = JSON.parse(storage.data.get(SETTINGS_STORAGE_KEY) ?? 'null') as { schemaVersion: number };
    expect(raw.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
    expect(new LocalSettingsStore(() => storage).get()).toEqual(changed);
  });

  it('falls back to the defaults when the stored text is not JSON', () => {
    const store = new LocalSettingsStore(() => fakeStorage({ [SETTINGS_STORAGE_KEY]: '{not json' }));
    expect(store.get()).toEqual(defaultSettings());
  });

  it('falls back to the defaults when the stored shape is wrong', () => {
    const store = new LocalSettingsStore(() => fakeStorage({ [SETTINGS_STORAGE_KEY]: JSON.stringify({ schemaVersion: 1, fontSize: 42 }) }));
    expect(store.get().fontSize).toBe('standard');
  });

  it('falls back to the defaults, and does not throw, when reading the storage throws', () => {
    const store = new LocalSettingsStore(() => fakeStorage({}, { throwOnRead: true }));
    expect(() => store.get()).not.toThrow();
    expect(store.get()).toEqual(defaultSettings());
  });

  it('falls back to the defaults when the storage itself is unavailable', () => {
    const store = new LocalSettingsStore(() => null);
    expect(store.get()).toEqual(defaultSettings());
    expect(store.set(defaultSettings())).toBe(false);
  });

  it('reports a failed save instead of throwing, so the game keeps running', () => {
    const store = new LocalSettingsStore(() => fakeStorage({}, { throwOnWrite: true }));
    expect(() => store.set(defaultSettings())).not.toThrow();
    expect(store.set(defaultSettings())).toBe(false);
  });

  it('never writes save-game data: the stored record only holds settings fields', () => {
    const storage = fakeStorage();
    new LocalSettingsStore(() => storage).set(defaultSettings());
    const raw = JSON.parse(storage.data.get(SETTINGS_STORAGE_KEY) ?? 'null') as Record<string, unknown>;
    expect(Object.keys(raw).sort()).toEqual(['bindings', 'colorblind', 'effects', 'fontSize', 'schemaVersion', 'touchControls']);
  });
});
