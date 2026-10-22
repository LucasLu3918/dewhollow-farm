import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../domain/keybindings';
import { defaultSettings, type Settings } from '../domain/settings';
import { SettingsService, type SettingsStore } from './settings';

/** 記憶體中的設定儲存：記下每一次寫入，方便檢查。 */
function memoryStore(initial: Settings = defaultSettings()): SettingsStore & { writes: Settings[] } {
  let current = initial;
  const writes: Settings[] = [];
  return {
    writes,
    get: () => current,
    set: (next) => {
      current = next;
      writes.push(next);
      return true;
    },
  };
}

describe('SettingsService', () => {
  it('starts from whatever the store returns', () => {
    const start = { ...defaultSettings(), fontSize: 'xlarge' as const };
    const service = new SettingsService(memoryStore(start));
    expect(service.get().fontSize).toBe('xlarge');
  });

  it('saves a patch through the store and notifies listeners with the new value', () => {
    const store = memoryStore();
    const service = new SettingsService(store);
    const seen: Settings[] = [];
    service.onChange((s) => seen.push(s));

    service.update({ colorblind: true });

    expect(service.get().colorblind).toBe(true);
    expect(store.writes).toHaveLength(1);
    expect(seen.map((s) => s.colorblind)).toEqual([true]);
  });

  it('keeps the other fields when only one field is patched', () => {
    const service = new SettingsService(memoryStore());
    service.update({ fontSize: 'large' });
    expect(service.get().bindings).toEqual(DEFAULT_BINDINGS);
    expect(service.get().touchControls).toBe('auto');
  });

  it('stops notifying a listener after it unsubscribes', () => {
    const service = new SettingsService(memoryStore());
    let calls = 0;
    const off = service.onChange(() => (calls += 1));
    service.update({ colorblind: true });
    off();
    service.update({ colorblind: false });
    expect(calls).toBe(1);
  });
});
