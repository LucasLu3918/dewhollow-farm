import { describe, expect, it } from 'vitest';
import { ACTION_IDS, DEFAULT_BINDINGS, bindingsAreValid, type ActionId } from '../domain/keybindings';
import { TOUCH_BUTTONS, touchKeyFor, touchVisible } from './touch-pad';

describe('virtual pad layout', () => {
  it('offers the four directions and the everyday action keys', () => {
    const actions = TOUCH_BUTTONS.map((b) => b.action);
    for (const move of ['moveUp', 'moveDown', 'moveLeft', 'moveRight'] as const) expect(actions).toContain(move);
    for (const key of ['interact', 'cycleTool', 'cycleSeed', 'skills', 'residents', 'collection', 'quests', 'manualSave'] as const) {
      expect(actions).toContain(key);
    }
  });

  it('only lists real actions, each at most once', () => {
    const actions = TOUCH_BUTTONS.map((b) => b.action);
    expect(new Set(actions).size).toBe(actions.length);
    for (const action of actions) expect(ACTION_IDS).toContain(action as ActionId);
  });

  it('never offers Esc or a key that is not in the action table', () => {
    for (const button of TOUCH_BUTTONS) {
      expect(touchKeyFor(button.action, DEFAULT_BINDINGS)).not.toBe('Escape');
    }
  });

  it('sends the key the action is currently bound to, so a rebinding also applies to taps', () => {
    const rebound = { ...DEFAULT_BINDINGS, interact: 'e', wear: 'x' };
    expect(bindingsAreValid(rebound)).toBe(true);
    expect(touchKeyFor('interact', rebound)).toBe('e');
    expect(touchKeyFor('moveUp', rebound)).toBe('ArrowUp');
  });

  it('gives every button a visible label', () => {
    for (const button of TOUCH_BUTTONS) expect(button.label.trim().length).toBeGreaterThan(0);
  });

  it('offers the direct tool grabs and the cabin actions', () => {
    const tool = TOUCH_BUTTONS.filter((b) => b.group === 'tool').map((b) => b.action);
    expect(tool).toEqual(['takeAxe', 'takePick', 'takeRod', 'takeSickle', 'placeDecor', 'wear', 'takeOff']);
  });

  it('keeps the direction group in the same order', () => {
    const move = TOUCH_BUTTONS.filter((b) => b.group === 'move');
    expect(move.map((b) => b.action)).toEqual(['moveUp', 'moveLeft', 'moveRight', 'moveDown']);
    expect(move.map((b) => b.label)).toEqual(['↑', '←', '→', '↓']);
  });

  it('only uses known groups', () => {
    for (const button of TOUCH_BUTTONS) expect(['move', 'act', 'tool']).toContain(button.group);
  });

  it('gives every button a unique label and a unique screen-reader name', () => {
    const labels = TOUCH_BUTTONS.map((b) => b.label);
    const names = TOUCH_BUTTONS.map((b) => b.name);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every touch action a default key, and the defaults do not collide', () => {
    const keys = TOUCH_BUTTONS.map((b) => touchKeyFor(b.action, DEFAULT_BINDINGS));
    for (const key of keys) expect(key.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
    expect(bindingsAreValid(DEFAULT_BINDINGS)).toBe(true);
  });

  it('sends the rebound key for the tool and cabin buttons too', () => {
    const rebound = { ...DEFAULT_BINDINGS, takeAxe: 'y', placeDecor: 'u' };
    expect(bindingsAreValid(rebound)).toBe(true);
    expect(touchKeyFor('takeAxe', rebound)).toBe('y');
    expect(touchKeyFor('placeDecor', rebound)).toBe('u');
    expect(touchKeyFor('wear', rebound)).toBe(DEFAULT_BINDINGS.wear);
  });
});

describe('virtual pad visibility', () => {
  it('shows on a touch screen by default and hides on a mouse-only device', () => {
    expect(touchVisible('auto', true)).toBe(true);
    expect(touchVisible('auto', false)).toBe(false);
  });

  it('can be forced on or off in the settings', () => {
    expect(touchVisible('on', false)).toBe(true);
    expect(touchVisible('off', true)).toBe(false);
  });
});
