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

    redraw(paint: () => void): void {
      paint();
    }

    restoreFocusIfLost(): void {}
  },
}));

class FakeElement {
  hidden = false;
  readonly dataset: Record<string, string> = {};
  readonly style = { setProperty: (_name: string, _value: string) => undefined };
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly classList = { add: (value: string) => { this.className = `${this.className} ${value}`.trim(); } };
  ownerDocument!: FakeDocument;
  parentElement: FakeElement | null = null;
  className = '';
  id = '';
  type = '';
  src = '';
  alt = '';
  loading = '';
  tabIndex = 0;
  isFragment = false;
  private ownText = '';
  private readonly listeners = new Map<string, Array<() => void>>();

  get textContent(): string {
    return this.ownText + this.children.map((child) => child.textContent).join('');
  }

  set textContent(value: string) {
    this.replaceChildren();
    this.ownText = value;
  }

  addEventListener(type: string, listener: () => void): void {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  click(): void {
    for (const listener of this.listeners.get('click') ?? []) listener();
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  append(...elements: FakeElement[]): void {
    for (const element of elements) {
      if (element.isFragment) {
        this.append(...element.children.splice(0));
        continue;
      }
      element.parentElement = this;
      this.children.push(element);
    }
  }

  replaceChildren(...elements: FakeElement[]): void {
    for (const child of this.children) child.parentElement = null;
    this.children.length = 0;
    this.ownText = '';
    this.append(...elements);
  }

  querySelector(selector: string): FakeElement | null {
    const matches = (element: FakeElement): boolean => {
      if (selector.startsWith('.')) return element.className.split(' ').includes(selector.slice(1));
      if (selector.startsWith('#')) return element.id === selector.slice(1);
      return false;
    };
    for (const child of this.children) {
      if (matches(child)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }

  focus(): void {
    this.ownerDocument.activeElement = this;
  }

  remove(): void {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }
}

class FakeDocument {
  activeElement: FakeElement | null = null;
  readonly elements = new Map<string, FakeElement>();

  createElement(): FakeElement {
    const element = new FakeElement();
    element.ownerDocument = this;
    return element;
  }

  createDocumentFragment(): FakeElement {
    const fragment = this.createElement();
    fragment.isFragment = true;
    return fragment;
  }

  querySelector(selector: string): FakeElement | null {
    return this.elements.get(selector.slice(1)) ?? null;
  }
}

function panelFixture(): { panel: InventoryPanel; trigger: FakeElement; root: FakeElement; close: FakeElement; grid: FakeElement; detail: FakeElement } {
  const doc = new FakeDocument();
  const trigger = doc.createElement();
  const root = doc.createElement();
  const close = doc.createElement();
  const content = doc.createElement();
  const grid = doc.createElement();
  root.hidden = true;
  const elements = new Map<string, FakeElement>([
    ['hud-inventory', trigger],
    ['inventory-panel', root],
    ['inventory-close', close],
    ['inventory-content', content],
    ['inventory-grid', grid],
    ['inventory-capacity', doc.createElement()],
    ['inventory-full', doc.createElement()],
    ['inventory-empty', doc.createElement()],
    ['inventory-filter-all', doc.createElement()],
    ['inventory-filter-farming', doc.createElement()],
    ['inventory-filter-materials', doc.createElement()],
    ['inventory-filter-food', doc.createElement()],
    ['inventory-filter-wearables', doc.createElement()],
    ['inventory-filter-other', doc.createElement()],
  ]);
  for (const [id, element] of elements) doc.elements.set(id, element);
  const panel = new InventoryPanel(doc as unknown as Document);
  return { panel, trigger, root, close, grid, detail: content.children[0]! };
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

  it('shows only the exact selected stack details and clears selection when that stack is filtered out', () => {
    const { panel, grid, detail } = panelFixture();
    panel.setDataProvider(() => ({
      capacity: 3,
      entries: [
        { itemId: 'seed.sweet-radish', name: '甜蘿蔔種子', category: '種子', count: 5, quality: 'normal', qualityLabel: '普通', uses: ['播種'] },
        { itemId: 'wood', name: '木材', category: '材料', count: 3, quality: 'good', qualityLabel: '優良', sellPrice: 12, uses: [] },
      ],
      resolveIcon: () => ({ status: 'missing', diagnostic: 'missing-icon' }),
    }));

    panel.open();
    expect(detail.dataset.state).toBe('empty');
    grid.children[0]!.click();

    expect(detail.dataset).toMatchObject({ state: 'selected', itemId: 'seed.sweet-radish', quality: 'normal', count: '5' });
    expect(detail.textContent).toContain('播種');
    expect(detail.textContent).not.toContain('售價');
    expect(grid.children[0]!.getAttribute('aria-selected')).toBe('true');
    expect(grid.children[1]!.getAttribute('aria-selected')).toBe('false');

    const foodFilter = (panel as unknown as { root: { ownerDocument: FakeDocument } }).root.ownerDocument.elements.get('inventory-filter-food')!;
    foodFilter.click();
    expect(detail.dataset.state).toBe('empty');
    expect(detail.dataset.itemId).toBeUndefined();
  });

  it('renders a sell price only when the selected entry provides one', () => {
    const { panel, grid, detail } = panelFixture();
    panel.setDataProvider(() => ({
      capacity: 2,
      entries: [{ itemId: 'wood', name: '木材', category: '材料', count: 3, quality: 'good', qualityLabel: '優良', sellPrice: 12, uses: [] }],
      resolveIcon: () => ({ status: 'missing', diagnostic: 'missing-icon' }),
    }));

    panel.open();
    grid.children[0]!.click();

    expect(detail.textContent).toContain('售價：12 銅幣／個');
    expect(detail.textContent).toContain('優良');
    expect(detail.textContent).toContain('數量：3');
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
