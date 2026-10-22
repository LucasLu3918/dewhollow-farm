import type { ActionId } from '../domain/keybindings';

/** State shared by keyboard and touch input before an action reaches the scene. */
export interface ActionGateState {
  sceneActive: boolean;
  settingsCapturing: boolean;
  heartEventOpen: boolean;
  reelPending: boolean;
  starPending: boolean;
  modalOpen: boolean;
  actionInProgress: boolean;
}

export type ActionGateDecision = 'dispatch' | 'finish-reel' | 'finish-star' | 'close-modal' | 'ignore';

/** Decide whether a semantic player action may enter the map scene right now. */
export function gateAction(action: ActionId, state: ActionGateState, escapePressed = false): ActionGateDecision {
  if (!state.sceneActive || state.settingsCapturing || state.heartEventOpen) return 'ignore';
  if (state.reelPending) return action === 'interact' ? 'finish-reel' : 'ignore';
  if (state.starPending) return action === 'interact' ? 'finish-star' : 'ignore';
  if (state.modalOpen) return escapePressed ? 'close-modal' : 'ignore';
  if (state.actionInProgress) return 'ignore';
  return 'dispatch';
}
