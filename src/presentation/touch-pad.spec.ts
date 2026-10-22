import { describe, expect, it, vi } from 'vitest';
import controls from '../../content/controls.json';
import { ACTION_IDS, type ActionId } from '../domain/keybindings';
import { parseControlsContent } from '../infrastructure/content/controls-content';
import { TOUCH_LAYOUT, TOUCH_REPEAT_MS, buildTouchButtons, directionForJoystick, MoveInputScheduler, touchVisible } from './touch-pad';

/** 按鈕文字來自 content/controls.json（與遊戲載入的是同一份）；測試的預期值不變。 */
const TOUCH_BUTTONS = buildTouchButtons(parseControlsContent(controls).touchButtons);

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

  it('keeps touch actions semantic and independent of keyboard bindings', () => {
    expect(TOUCH_BUTTONS.find((button) => button.action === 'interact')?.action).toBe('interact');
    expect(TOUCH_BUTTONS.find((button) => button.action === 'wear')?.action).toBe('wear');
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
    for (const button of TOUCH_BUTTONS) expect(['move', 'act', 'menu', 'tool']).toContain(button.group);
  });

  it('keeps the everyday keys visible and folds the menus and tool grabs into the more panel', () => {
    const groupOf = (action: string) => TOUCH_BUTTONS.find((b) => b.action === action)?.group;
    for (const action of ['interact', 'cycleTool', 'cycleSeed']) expect(groupOf(action)).toBe('act');
    for (const action of ['skills', 'residents', 'collection', 'quests', 'manualSave']) expect(groupOf(action)).toBe('menu');
  });

  it('gives every button a unique label and a unique screen-reader name', () => {
    const labels = TOUCH_BUTTONS.map((b) => b.label);
    const names = TOUCH_BUTTONS.map((b) => b.name);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(names).size).toBe(names.length);
  });

});

describe('virtual pad text source', () => {
  it('has exactly one text entry in content/controls.json for every button in the layout', () => {
    const laid = TOUCH_LAYOUT.map((entry) => entry.action).sort();
    expect(Object.keys(controls.touchButtons).sort()).toEqual(laid);
  });
});

describe('virtual pad visibility', () => {
  it('shows on a touch screen by default and hides on a mouse-only device', () => {
    expect(touchVisible('auto', true)).toBe(true);
    expect(touchVisible('auto', false)).toBe(false);
    expect(touchVisible('auto', false, 2)).toBe(true);
    expect(touchVisible('auto', false, 0)).toBe(false);
  });

  it('can be forced on or off in the settings', () => {
    expect(touchVisible('on', false)).toBe(true);
    expect(touchVisible('off', true)).toBe(false);
  });
});

describe('joystick direction', () => {
  it('uses a dead zone and quantizes diagonals to the dominant cardinal axis', () => {
    expect(directionForJoystick(0.1, 0.1)).toBeNull();
    expect(directionForJoystick(0.9, 0.8)).toBe('right');
    expect(directionForJoystick(-0.4, -0.8)).toBe('up');
  });

  it('keeps the current axis near a diagonal boundary and permits decisive axis changes', () => {
    expect(directionForJoystick(0.7, 0.72, 'right')).toBe('right');
    expect(directionForJoystick(0.45, 0.8, 'right')).toBe('down');
    expect(directionForJoystick(-0.8, 0, 'right')).toBe('left');
  });
});

describe('multi-pointer movement scheduler', () => {
  it('releases only the changed pointer and resumes another held direction', () => {
    vi.useFakeTimers();
    try {
      const moved = vi.fn();
      const scheduler = new MoveInputScheduler(moved);
      scheduler.setPointer(1, 'up');
      scheduler.setPointer(2, 'right');
      expect(moved.mock.calls.map(([direction]) => direction)).toEqual(['up', 'right']);

      scheduler.releasePointer(2);
      expect(moved.mock.calls.map(([direction]) => direction)).toEqual(['up', 'right', 'up']);
      vi.advanceTimersByTime(TOUCH_REPEAT_MS);
      expect(moved.mock.calls.at(-1)?.[0]).toBe('up');

      scheduler.releasePointer(1);
      const callsAtRelease = moved.mock.calls.length;
      vi.advanceTimersByTime(TOUCH_REPEAT_MS * 2);
      expect(moved).toHaveBeenCalledTimes(callsAtRelease);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops immediately when all active pointers are cancelled', () => {
    vi.useFakeTimers();
    try {
      const moved = vi.fn();
      const scheduler = new MoveInputScheduler(moved);
      scheduler.setPointer(7, 'left');
      scheduler.cancelAll();
      const callsAtCancel = moved.mock.calls.length;
      vi.advanceTimersByTime(TOUCH_REPEAT_MS * 2);
      expect(moved).toHaveBeenCalledTimes(callsAtCancel);
      expect(scheduler.activeDirection).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
