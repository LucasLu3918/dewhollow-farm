import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from './keybindings';
import { SETTINGS_SCHEMA_VERSION, defaultSettings, sanitizeSettings } from './settings';

describe('default settings', () => {
  it('starts with the default keys, standard text, no colour-blind marks, and every flash and shake on', () => {
    const s = defaultSettings();
    expect(s.bindings).toEqual(DEFAULT_BINDINGS);
    expect(s.fontSize).toBe('standard');
    expect(s.colorblind).toBe(false);
    expect(s.effects).toEqual({ shake: true, flash: true, particles: true });
    expect(s.touchControls).toBe('auto');
  });

  it('returns a fresh object each time so callers cannot change the defaults', () => {
    const a = defaultSettings();
    a.bindings = { ...a.bindings, interact: 'q' };
    expect(defaultSettings().bindings.interact).toBe('x');
  });
});

describe('sanitizeSettings', () => {
  it('falls back to every default when the stored value is not an object', () => {
    expect(sanitizeSettings(null)).toEqual(defaultSettings());
    expect(sanitizeSettings('oops')).toEqual(defaultSettings());
    expect(sanitizeSettings([1, 2, 3])).toEqual(defaultSettings());
  });

  it('falls back to every default when the schema version is unknown', () => {
    expect(sanitizeSettings({ schemaVersion: 99, fontSize: 'xlarge' })).toEqual(defaultSettings());
    expect(sanitizeSettings({ fontSize: 'xlarge' })).toEqual(defaultSettings());
  });

  it('keeps the valid fields it can read and defaults the others one by one', () => {
    const s = sanitizeSettings({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      fontSize: 'xlarge',
      colorblind: 'yes',
      effects: { shake: false, flash: 'nope' },
      touchControls: 'sometimes',
    });
    expect(s.fontSize).toBe('xlarge');
    expect(s.colorblind).toBe(false);
    expect(s.effects).toEqual({ shake: false, flash: true, particles: true });
    expect(s.touchControls).toBe('auto');
  });

  it('rejects a font size that is not one of the three steps', () => {
    expect(sanitizeSettings({ schemaVersion: 1, fontSize: 'huge' }).fontSize).toBe('standard');
  });

  it('discards a key table that is not valid (missing action, duplicate key, or Esc) and uses the defaults', () => {
    const missing = { ...DEFAULT_BINDINGS } as Record<string, string>;
    delete missing.mute;
    expect(sanitizeSettings({ schemaVersion: 1, bindings: missing }).bindings).toEqual(DEFAULT_BINDINGS);
    expect(sanitizeSettings({ schemaVersion: 1, bindings: { ...DEFAULT_BINDINGS, interact: 'z' } }).bindings).toEqual(
      DEFAULT_BINDINGS,
    );
    expect(sanitizeSettings({ schemaVersion: 1, bindings: { ...DEFAULT_BINDINGS, help: 'Escape' } }).bindings).toEqual(
      DEFAULT_BINDINGS,
    );
  });

  it('keeps a valid custom key table', () => {
    const custom = { ...DEFAULT_BINDINGS, interact: 'e', wear: 'x' };
    expect(sanitizeSettings({ schemaVersion: 1, bindings: custom }).bindings).toEqual(custom);
  });
});
