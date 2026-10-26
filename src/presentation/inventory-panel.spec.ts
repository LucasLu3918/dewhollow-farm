import { describe, expect, it, vi } from 'vitest';
import { InventoryPanel } from './inventory-panel';

vi.mock('./panel-dialog', () => ({
  PanelDialog: class {
    private open_ = false;

    constructor(private readonly root: { hidden: boolean }) {}

    isOpen(): boolean {
      return this.open_;
    }

    open(): void {
      if (this.open_) return;
      this.open_ = true;
      this.root.hidden = false;
    }

    close(): void {
      if (!this.open_) return;
      this.open_ = false;
      this.root.hidden = true;
    }
  },
}));

class FakeElement {
  hidden = false;
  readonly style = { setProperty: (_name: string, _value: string) => undefined };
  private readonly listeners = new Map<string, Array<() => void>>();

  addEventListener(type: string, listener: () => void): void {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
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
  it('opens from the HUD entry through its modal dialog', () => {
    const { panel, trigger, root } = panelFixture();

    trigger.click();

    expect(root.hidden).toBe(false);
    expect(panel.isOpen()).toBe(true);
  });

  it('closes from the panel and updates the modal state', () => {
    const { panel, trigger, root, close } = panelFixture();
    trigger.click();

    close.click();

    expect(root.hidden).toBe(true);
    expect(panel.isOpen()).toBe(false);
  });

  it('is idempotent when opened or closed repeatedly', () => {
    const { panel, root } = panelFixture();

    panel.open();
    panel.open();
    expect(panel.isOpen()).toBe(true);

    panel.close();
    panel.close();
    expect(root.hidden).toBe(true);
  });
});
