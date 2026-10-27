import { describe, expect, it } from 'vitest';
import {
  ACTION_IDS,
  DEFAULT_BINDINGS,
  actionForKey,
  assignKey,
  bindingsAreValid,
  keyLabel,
  normalizeKey,
  resetBindings,
  type ActionId,
} from './keybindings';

describe('default bindings', () => {
  it('keeps every action bound to exactly one key, and the keys are unique', () => {
    expect(Object.keys(DEFAULT_BINDINGS).sort()).toEqual([...ACTION_IDS].sort());
    const keys = Object.values(DEFAULT_BINDINGS);
    expect(new Set(keys).size).toBe(keys.length);
    expect(bindingsAreValid(DEFAULT_BINDINGS)).toBe(true);
  });

  it('matches the keys the game shipped with before rebinding existed', () => {
    expect(DEFAULT_BINDINGS.moveUp).toBe('ArrowUp');
    expect(DEFAULT_BINDINGS.interact).toBe('x');
    expect(DEFAULT_BINDINGS.takeSickle).toBe('g');
    expect(DEFAULT_BINDINGS.help).toBe('?');
    expect(DEFAULT_BINDINGS.mute).toBe('m');
    expect(DEFAULT_BINDINGS.inventory).toBe('i');
    expect(DEFAULT_BINDINGS.collection).toBe('c');
    expect(DEFAULT_BINDINGS.cycleSeed).toBe('n');
  });

  it('resetBindings returns a fresh copy of the defaults, not the shared object', () => {
    const copy = resetBindings();
    expect(copy).toEqual(DEFAULT_BINDINGS);
    expect(copy).not.toBe(DEFAULT_BINDINGS);
  });
});

describe('normalizeKey', () => {
  it('folds single letters to lower case so Shift and CapsLock do not change the action', () => {
    expect(normalizeKey('X')).toBe('x');
    expect(normalizeKey('x')).toBe('x');
  });

  it('leaves named keys and punctuation alone', () => {
    expect(normalizeKey('ArrowUp')).toBe('ArrowUp');
    expect(normalizeKey('?')).toBe('?');
    expect(normalizeKey('Escape')).toBe('Escape');
  });
});

describe('actionForKey', () => {
  it('finds the action for a pressed key using the table, not hard-coded characters', () => {
    expect(actionForKey(DEFAULT_BINDINGS, 'X')).toBe('interact');
    expect(actionForKey(DEFAULT_BINDINGS, 'ArrowLeft')).toBe('moveLeft');
    expect(actionForKey(DEFAULT_BINDINGS, 'F13')).toBeNull();
    expect(actionForKey(DEFAULT_BINDINGS, 'I')).toBe('inventory');
    expect(actionForKey(DEFAULT_BINDINGS, 'C')).toBe('collection');
    expect(actionForKey(DEFAULT_BINDINGS, 'N')).toBe('cycleSeed');
  });

  it('follows a rebinding: the new key works and the old key no longer does', () => {
    const result = assignKey(DEFAULT_BINDINGS, 'interact', 'u');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(actionForKey(result.bindings, 'u')).toBe('interact');
    expect(actionForKey(result.bindings, 'x')).toBeNull();
  });
});

describe('assignKey conflicts', () => {
  it('refuses a key that another action already uses and names that action', () => {
    const result = assignKey(DEFAULT_BINDINGS, 'interact', 'z');
    expect(result).toEqual({ ok: false, reason: 'CONFLICT', conflict: 'cycleTool' });
  });

  it('does not change the bindings when it refuses', () => {
    const before = { ...DEFAULT_BINDINGS };
    assignKey(DEFAULT_BINDINGS, 'interact', 'z');
    expect(DEFAULT_BINDINGS).toEqual(before);
  });

  it('swaps the two keys when the player chooses to swap', () => {
    const result = assignKey(DEFAULT_BINDINGS, 'interact', 'z', { swap: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.swappedWith).toBe('cycleTool');
    expect(result.bindings.interact).toBe('z');
    expect(result.bindings.cycleTool).toBe('x');
    expect(bindingsAreValid(result.bindings)).toBe(true);
  });

  it('assigning an action its own key is a no-op, not a conflict', () => {
    const result = assignKey(DEFAULT_BINDINGS, 'interact', 'X');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bindings).toEqual(DEFAULT_BINDINGS);
  });

  it('compares keys after normalizing, so Shift+Z conflicts with z', () => {
    expect(assignKey(DEFAULT_BINDINGS, 'interact', 'Z')).toEqual({ ok: false, reason: 'CONFLICT', conflict: 'cycleTool' });
  });
});

describe('assignKey reserved keys', () => {
  it('never lets Esc be bound, because Esc is kept for closing panels', () => {
    expect(assignKey(DEFAULT_BINDINGS, 'interact', 'Escape')).toEqual({ ok: false, reason: 'RESERVED' });
    expect(assignKey(DEFAULT_BINDINGS, 'moveUp', 'Escape', { swap: true })).toEqual({ ok: false, reason: 'RESERVED' });
  });

  it('keeps Esc out of the default table and unmapped to any action', () => {
    expect(Object.values(DEFAULT_BINDINGS)).not.toContain('Escape');
    expect(actionForKey(DEFAULT_BINDINGS, 'Escape')).toBeNull();
  });

  it('refuses modifier keys on their own, and an empty key', () => {
    expect(assignKey(DEFAULT_BINDINGS, 'interact', 'Shift')).toEqual({ ok: false, reason: 'UNBINDABLE' });
    expect(assignKey(DEFAULT_BINDINGS, 'interact', 'Control')).toEqual({ ok: false, reason: 'UNBINDABLE' });
    expect(assignKey(DEFAULT_BINDINGS, 'interact', '')).toEqual({ ok: false, reason: 'UNBINDABLE' });
  });

  it('allows the movement keys to be rebound, to letters or to other arrows', () => {
    const result = assignKey(DEFAULT_BINDINGS, 'moveUp', 'w');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bindings.moveUp).toBe('w');
  });
});

describe('bindingsAreValid', () => {
  it('rejects a table where two actions share a key', () => {
    const broken = { ...DEFAULT_BINDINGS, interact: 'z' };
    expect(bindingsAreValid(broken)).toBe(false);
  });

  it('rejects a table that binds Esc or misses an action', () => {
    expect(bindingsAreValid({ ...DEFAULT_BINDINGS, help: 'Escape' })).toBe(false);
    const missing: Partial<Record<ActionId, string>> = { ...DEFAULT_BINDINGS };
    delete missing.mute;
    expect(bindingsAreValid(missing)).toBe(false);
  });
});

describe('keyLabel', () => {
  it('shows arrows as symbols and a space as the word Space', () => {
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel('ArrowLeft')).toBe('←');
    expect(keyLabel(' ')).toBe('Space');
  });

  it('shows letters in upper case and leaves other keys as they are', () => {
    expect(keyLabel('x')).toBe('X');
    expect(keyLabel('?')).toBe('?');
  });
});
