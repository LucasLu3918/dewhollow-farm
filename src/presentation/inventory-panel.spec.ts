import { describe, expect, it, vi } from 'vitest';
import { filterInventoryEntries, InventoryPanel, inventorySlotCount, isInventoryFull } from './inventory-panel';
import type { InventoryDisplayEntry } from '../application/inventory-display';

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
  readonly dataset: Record<string, string> = {};
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

  setAttribute(_name: string, _value: string): void {}
}

function panelFixture(): { panel: InventoryPanel; trigger: FakeElement; root: FakeElement; close: FakeElement } {
  const trigger = new FakeElement();
  const root = new FakeElement();
  const close = new FakeElement();
  root.hidden = true;
  const elements = new Map<string, FakeElement>([
    ['hud-inventory', trigger],
    ['inventory-panel', root],
    ['inventory-close', close],
    ['inventory-grid', new FakeElement()],
    ['inventory-capacity', new FakeElement()],
    ['inventory-full', new FakeElement()],
    ['inventory-empty', new FakeElement()],
    ['inventory-filter-all', new FakeElement()],
    ['inventory-filter-farming', new FakeElement()],
    ['inventory-filter-materials', new FakeElement()],
    ['inventory-filter-food', new FakeElement()],
    ['inventory-filter-wearables', new FakeElement()],
    ['inventory-filter-other', new FakeElement()],
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

const entries: InventoryDisplayEntry[] = [
  { itemId: 'seed.sweet-radish', name: '甜蘿蔔種子', category: '種子', count: 5, quality: 'normal', qualityLabel: '普通', uses: ['播種'] },
  { itemId: 'wood', name: '木材', category: '材料', count: 3, quality: 'good', qualityLabel: '優良', uses: [] },
  { itemId: 'fish.carp', name: '鯉魚', category: '魚類', count: 1, quality: 'fine', qualityLabel: '精良', uses: [] },
  { itemId: 'decor.flower-crown', name: '花冠', category: '裝飾', count: 1, quality: 'normal', qualityLabel: '普通', uses: ['穿戴'] },
  { itemId: 'recipe.sun-hat', name: '草帽配方', category: '配方', count: 1, quality: 'normal', qualityLabel: '普通', uses: ['學習配方'] },
];

describe('inventory grid view helpers', () => {
  it('keeps the initial grid at 24 slots and expands to the real capacity', () => {
    expect(inventorySlotCount(24)).toBe(24);
    expect(inventorySlotCount(30)).toBe(30);
  });

  it('reports full only when every real capacity slot is occupied', () => {
    expect(isInventoryFull(23, 24)).toBe(false);
    expect(isInventoryFull(24, 24)).toBe(true);
  });

  it('filters entries by the planned content categories without merging stacks', () => {
    const sameItemDifferentQuality = { ...entries[1]!, quality: 'fine' as const, qualityLabel: '精良' };
    const withQualityStack = [...entries, sameItemDifferentQuality];

    expect(filterInventoryEntries(withQualityStack, 'all')).toHaveLength(6);
    expect(filterInventoryEntries(withQualityStack, 'farming').map((entry) => entry.itemId)).toEqual(['seed.sweet-radish']);
    expect(filterInventoryEntries(withQualityStack, 'materials')).toHaveLength(2);
    expect(filterInventoryEntries(withQualityStack, 'food').map((entry) => entry.itemId)).toEqual(['fish.carp']);
    expect(filterInventoryEntries(withQualityStack, 'wearables').map((entry) => entry.itemId)).toEqual(['decor.flower-crown']);
    expect(filterInventoryEntries(withQualityStack, 'other').map((entry) => entry.itemId)).toEqual(['recipe.sun-hat']);
  });
});
