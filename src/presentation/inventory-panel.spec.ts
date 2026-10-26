import { describe, expect, it } from 'vitest';
import { InventoryPanel } from './inventory-panel';

class FakeElement {
  hidden = false;
  focused = false;
  readonly style = { setProperty: (_name: string, _value: string) => undefined };
  private readonly listeners = new Map<string, Array<() => void>>();

  addEventListener(type: string, listener: () => void): void {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  focus(): void {
    this.focused = true;
  }

  click(): void {
    for (const listener of this.listeners.get('click') ?? []) listener();
  }
}

function panelFixture(): { panel: InventoryPanel; trigger: FakeElement; root: FakeElement; close: FakeElement } {
  const trigger = new FakeElement();
  const root = new FakeElement();
  const close = new FakeElement();
  root.hidden = true;
  const elements = new Map([
    ['hud-inventory', trigger],
    ['inventory-panel', root],
    ['inventory-close', close],
  ]);
  const doc = { querySelector: (selector: string) => elements.get(selector.slice(1)) ?? null } as unknown as Document;
  return { panel: new InventoryPanel(doc), trigger, root, close };
}

describe('InventoryPanel', () => {
  it('opens from the HUD entry and moves focus into the panel', () => {
    const { trigger, root, close } = panelFixture();

    trigger.click();

    expect(root.hidden).toBe(false);
    expect(close.focused).toBe(true);
  });

  it('closes from the panel and returns focus to the HUD entry', () => {
    const { trigger, root, close } = panelFixture();
    trigger.click();
    trigger.focused = false;

    close.click();

    expect(root.hidden).toBe(true);
    expect(trigger.focused).toBe(true);
  });

  it('is idempotent when opened or closed repeatedly', () => {
    const { panel, trigger, root } = panelFixture();

    panel.open();
    panel.open();
    expect(root.hidden).toBe(false);

    panel.close();
    panel.close();
    expect(root.hidden).toBe(true);
    expect(trigger.focused).toBe(true);
  });
});
