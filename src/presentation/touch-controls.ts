import type { ActionId } from '../domain/keybindings';
import type { Direction } from '../domain/content';
import type { Handedness, MobileSettings } from '../domain/settings';
import type { SettingsService } from '../application/settings';
import {
  MoveInputScheduler,
  buildTouchButtons,
  directionForJoystick,
  type TouchButton,
  type TouchLabels,
  type TouchText,
} from './touch-pad';

const MOVE_DIRECTION: Partial<Record<ActionId, Direction>> = {
  moveUp: 'up',
  moveDown: 'down',
  moveLeft: 'left',
  moveRight: 'right',
};

const JOYSTICK_SIZE = 144;
const JOYSTICK_RADIUS = JOYSTICK_SIZE / 2 - 24;
const FLOATING_ACTIVATION_OUTSET = 12;

interface PointerGesture {
  kind: 'move-button' | 'action-button' | 'joystick';
  target: HTMLElement;
}

export function becameHidden(previous: boolean, current: boolean): boolean {
  return !previous && current;
}

/** DOM adapter for mobile input. Pointer state and repeat timing stay outside game state. */
export class TouchControls {
  private readonly root: HTMLElement;
  private readonly movePad: HTMLElement;
  private readonly joystickBase: HTMLElement;
  private readonly joystickKnob: HTMLElement;
  private readonly moreToggle: HTMLButtonElement;
  private readonly morePanel: HTMLElement;
  private readonly gestures = new Map<number, PointerGesture>();
  private readonly movement: MoveInputScheduler;
  private readonly stopOnResize = (): void => this.cancelAll('viewport-change');
  private readonly stopWhenHidden = (): void => {
    if (this.doc.visibilityState === 'hidden') this.cancelAll('document-hidden');
  };
  private readonly stopOnRootHidden = (): void => {
    const hidden = this.root.hidden;
    const becameInvisible = becameHidden(this.rootWasHidden, hidden);
    this.rootWasHidden = hidden;
    if (becameInvisible) this.cancelAll('controls-hidden');
  };
  private readonly observer: MutationObserver;
  private readonly unsubscribeSettings: () => void;
  private joystickPointerId: number | null = null;
  private joystickCenter = { x: 0, y: 0 };
  private joystickStyle: MobileSettings['controlStyle'] = 'dpad';
  private handedness: Handedness = 'right';
  private rootWasHidden = false;

  constructor(
    private readonly doc: Document,
    private readonly onPress: (action: ActionId) => void,
    labels: TouchLabels,
    more: TouchText,
    settings: SettingsService,
    private readonly onCancelAll: (reason: string) => void = () => undefined,
  ) {
    const root = doc.querySelector<HTMLElement>('#touch-controls');
    if (!root) throw new Error('頁面缺少必要元素 #touch-controls');
    this.root = root;
    this.rootWasHidden = root.hidden;
    root.replaceChildren();
    this.movement = new MoveInputScheduler((direction) => this.onPress(actionForDirection(direction)));

    const buttons = buildTouchButtons(labels);
    const common = doc.createElement('div');
    common.className = 'touch-common';
    this.movePad = this.group(doc, 'move', buttons);
    this.movePad.addEventListener('pointerdown', this.onJoystickDown);
    this.movePad.addEventListener('pointermove', this.onJoystickMove);
    this.movePad.addEventListener('pointerup', this.onPointerEnd);
    this.movePad.addEventListener('pointercancel', this.onPointerEnd);
    this.movePad.addEventListener('lostpointercapture', this.onPointerEnd);
    common.append(this.movePad);

    this.moreToggle = this.toggleButton(doc, more);
    const act = this.group(doc, 'act', buttons);
    act.append(this.moreToggle);
    common.append(act);
    root.append(common);

    this.joystickBase = doc.createElement('span');
    this.joystickBase.className = 'touch-joystick-base';
    this.joystickBase.setAttribute('aria-hidden', 'true');
    this.joystickKnob = doc.createElement('span');
    this.joystickKnob.className = 'touch-joystick-knob';
    this.joystickBase.append(this.joystickKnob);
    this.movePad.append(this.joystickBase);

    const pick = (action: ActionId): void => {
      this.setMoreOpen(false);
      this.onPress(action);
    };
    this.morePanel = doc.createElement('div');
    this.morePanel.id = 'touch-more';
    this.morePanel.className = 'touch-more';
    this.morePanel.hidden = true;
    this.morePanel.append(this.group(doc, 'menu', buttons, pick), this.group(doc, 'tool', buttons, pick));
    root.append(this.morePanel);
    this.moreToggle.setAttribute('aria-controls', this.morePanel.id);

    this.applyMobileSettings(settings.get().mobile);
    this.unsubscribeSettings = settings.onChange((next) => this.applyMobileSettings(next.mobile));
    this.observer = new MutationObserver(this.stopOnRootHidden);
    this.observer.observe(root, { attributes: true, attributeFilter: ['hidden'] });
    window.addEventListener('blur', this.stopOnResize);
    window.addEventListener('pagehide', this.stopOnResize);
    window.addEventListener('resize', this.stopOnResize, { passive: true });
    window.addEventListener('orientationchange', this.stopOnResize, { passive: true });
    doc.addEventListener('visibilitychange', this.stopWhenHidden);
  }

  /** Cancel every active gesture when a modal opens, the map changes or the scene shuts down. */
  cancelAll(reason = 'explicit'): void {
    this.onCancelAll(reason);
    const active = [...this.gestures.entries()];
    this.gestures.clear();
    this.movement.cancelAll();
    this.joystickPointerId = null;
    this.resetJoystick();
    for (const [pointerId, gesture] of active) {
      try {
        if (gesture.target.hasPointerCapture(pointerId)) gesture.target.releasePointerCapture(pointerId);
      } catch {
        // Browsers can already have released capture during blur, navigation or pointer cancellation.
      }
    }
  }

  dispose(): void {
    this.cancelAll();
    this.unsubscribeSettings();
    this.observer.disconnect();
    window.removeEventListener('blur', this.stopOnResize);
    window.removeEventListener('pagehide', this.stopOnResize);
    window.removeEventListener('resize', this.stopOnResize);
    window.removeEventListener('orientationchange', this.stopOnResize);
    this.doc.removeEventListener('visibilitychange', this.stopWhenHidden);
    this.root.replaceChildren();
  }

  private group(
    doc: Document,
    group: TouchButton['group'],
    buttons: TouchButton[],
    onPick: (action: ActionId) => void = this.onPress,
  ): HTMLElement {
    const wrap = doc.createElement('div');
    wrap.className = `touch-group touch-${group}`;
    for (const entry of buttons.filter((button) => button.group === group)) {
      const button = this.button(doc, entry, onPick);
      wrap.append(button);
    }
    return wrap;
  }

  private button(doc: Document, entry: TouchButton, onPick: (action: ActionId) => void): HTMLButtonElement {
    const el = doc.createElement('button');
    el.type = 'button';
    el.className = `touch-button touch-${entry.group}-button`;
    el.dataset.action = entry.action;
    el.textContent = entry.label;
    el.setAttribute('aria-label', entry.name);
    el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (this.gestures.has(event.pointerId)) return;
      const direction = MOVE_DIRECTION[entry.action];
      const kind = direction ? 'move-button' : 'action-button';
      this.gestures.set(event.pointerId, { kind, target: el });
      this.capture(el, event.pointerId);
      if (direction) this.movement.setPointer(event.pointerId, direction);
      else onPick(entry.action);
    });
    el.addEventListener('pointerup', this.onPointerEnd);
    el.addEventListener('pointercancel', this.onPointerEnd);
    el.addEventListener('lostpointercapture', this.onPointerEnd);
    el.addEventListener('contextmenu', (event) => event.preventDefault());
    return el;
  }

  private toggleButton(doc: Document, text: TouchText): HTMLButtonElement {
    const el = doc.createElement('button');
    el.type = 'button';
    el.className = 'touch-button touch-act-button touch-more-toggle';
    el.textContent = text.label;
    el.setAttribute('aria-label', text.name);
    el.setAttribute('aria-expanded', 'false');
    el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (this.gestures.has(event.pointerId)) return;
      this.gestures.set(event.pointerId, { kind: 'action-button', target: el });
      this.capture(el, event.pointerId);
      this.setMoreOpen(this.morePanel.hidden);
    });
    el.addEventListener('pointerup', this.onPointerEnd);
    el.addEventListener('pointercancel', this.onPointerEnd);
    el.addEventListener('lostpointercapture', this.onPointerEnd);
    el.addEventListener('contextmenu', (event) => event.preventDefault());
    return el;
  }

  private readonly onJoystickDown = (event: PointerEvent): void => {
    if (this.joystickStyle === 'dpad' || this.joystickPointerId !== null || this.gestures.has(event.pointerId)) return;
    event.preventDefault();
    const rect = this.movePad.getBoundingClientRect();
    this.joystickPointerId = event.pointerId;
    this.gestures.set(event.pointerId, { kind: 'joystick', target: this.movePad });
    this.capture(this.movePad, event.pointerId);
    if (this.joystickStyle === 'floating-joystick') {
      const radius = JOYSTICK_SIZE / 2;
      const x = clamp(
        event.clientX - rect.left,
        radius - FLOATING_ACTIVATION_OUTSET,
        rect.width + FLOATING_ACTIVATION_OUTSET - radius,
      );
      const y = clamp(
        event.clientY - rect.top,
        radius - FLOATING_ACTIVATION_OUTSET,
        rect.height + FLOATING_ACTIVATION_OUTSET - radius,
      );
      this.joystickBase.style.left = `${x}px`;
      this.joystickBase.style.top = `${y}px`;
      this.joystickBase.classList.add('is-active');
    } else {
      this.joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    this.updateJoystick(event);
  };

  private readonly onJoystickMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.joystickPointerId) return;
    event.preventDefault();
    this.updateJoystick(event);
  };

  private updateJoystick(event: PointerEvent): void {
    const rect = this.movePad.getBoundingClientRect();
    if (this.joystickStyle === 'floating-joystick') {
      this.joystickCenter = { x: rect.left + px(this.joystickBase.style.left), y: rect.top + px(this.joystickBase.style.top) };
    }
    const dx = (event.clientX - this.joystickCenter.x) / JOYSTICK_RADIUS;
    const dy = (event.clientY - this.joystickCenter.y) / JOYSTICK_RADIUS;
    const direction = directionForJoystick(dx, dy, this.movement.activeDirection);
    if (direction) this.movement.setPointer(event.pointerId, direction);
    else this.movement.releasePointer(event.pointerId);

    const length = Math.hypot(dx, dy);
    const scale = length > 1 ? 1 / length : 1;
    const x = dx * scale * JOYSTICK_RADIUS;
    const y = dy * scale * JOYSTICK_RADIUS;
    this.joystickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  }

  private readonly onPointerEnd = (event: PointerEvent): void => {
    const gesture = this.gestures.get(event.pointerId);
    if (!gesture) return;
    event.preventDefault();
    this.gestures.delete(event.pointerId);
    this.movement.releasePointer(event.pointerId);
    if (gesture.kind === 'joystick') {
      this.joystickPointerId = null;
      this.resetJoystick();
    }
  };

  private applyMobileSettings(settings: MobileSettings): void {
    const changed = settings.controlStyle !== this.joystickStyle || settings.handedness !== this.handedness;
    if (changed) this.cancelAll('mobile-controls-changed');
    this.joystickStyle = settings.controlStyle;
    this.handedness = settings.handedness;
    this.root.dataset.controlStyle = settings.controlStyle;
    this.root.dataset.handedness = settings.handedness;
    this.movePad.dataset.controlStyle = settings.controlStyle;
    this.resetJoystick();
  }

  private resetJoystick(): void {
    this.joystickBase.classList.remove('is-active');
    this.joystickKnob.style.transform = 'translate(-50%, -50%)';
    if (this.joystickStyle === 'fixed-joystick') {
      this.joystickBase.style.left = '50%';
      this.joystickBase.style.top = '50%';
    } else {
      this.joystickBase.style.left = '';
      this.joystickBase.style.top = '';
    }
  }

  private capture(target: HTMLElement, pointerId: number): void {
    try {
      target.setPointerCapture(pointerId);
    } catch {
      // Synthetic test events and browser teardown may not have a capturable active pointer.
    }
  }

  private setMoreOpen(open: boolean): void {
    this.morePanel.hidden = !open;
    this.moreToggle.setAttribute('aria-expanded', String(open));
    this.moreToggle.classList.toggle('is-open', open);
  }
}

function actionForDirection(direction: Direction): ActionId {
  switch (direction) {
    case 'up': return 'moveUp';
    case 'down': return 'moveDown';
    case 'left': return 'moveLeft';
    case 'right': return 'moveRight';
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function px(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
