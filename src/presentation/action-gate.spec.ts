import { describe, expect, it } from 'vitest';
import { gateAction, type ActionGateState } from './action-gate';

const open: ActionGateState = {
  sceneActive: true,
  settingsCapturing: false,
  heartEventOpen: false,
  reelPending: false,
  starPending: false,
  modalOpen: false,
  actionInProgress: false,
};

describe('shared action gate', () => {
  it('dispatches semantic actions when the map is ready', () => {
    expect(gateAction('moveUp', open)).toBe('dispatch');
    expect(gateAction('skills', open)).toBe('dispatch');
  });

  it.each([
    ['inactive scene', { sceneActive: false }],
    ['key remapping', { settingsCapturing: true }],
    ['heart event', { heartEventOpen: true }],
    ['modal panel', { modalOpen: true }],
    ['action in progress', { actionInProgress: true }],
  ] as const)('ignores actions during %s', (_name, state) => {
    expect(gateAction('moveDown', { ...open, ...state })).toBe('ignore');
  });

  it('allows only the active fishing interaction and never dispatches a second action', () => {
    expect(gateAction('interact', { ...open, reelPending: true })).toBe('finish-reel');
    expect(gateAction('moveLeft', { ...open, reelPending: true })).toBe('ignore');
    expect(gateAction('interact', { ...open, starPending: true })).toBe('finish-star');
    expect(gateAction('takeRod', { ...open, starPending: true })).toBe('ignore');
  });

  it('lets Escape close the current modal without dispatching a game action', () => {
    expect(gateAction('moveRight', { ...open, modalOpen: true }, true)).toBe('close-modal');
    expect(gateAction('moveRight', { ...open, modalOpen: true })).toBe('ignore');
  });
});
