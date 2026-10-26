import type { InventoryDisplayEntry } from '../application/inventory-display';
import type { ItemIconResolution } from '../infrastructure/assets/asset-manifest';
import { createItemIconView } from './item-icon';
import { applyGameUiTokens } from './game-ui-tokens';
import { PanelDialog } from './panel-dialog';

export type InventoryCategory = 'all' | 'farming' | 'materials' | 'food' | 'wearables' | 'other';

export interface InventoryPanelData {
  capacity: number;
  entries: readonly InventoryDisplayEntry[];
  resolveIcon: (itemId: string) => ItemIconResolution;
}

interface InventoryFilter {
  id: InventoryCategory;
  label: string;
}

const FILTERS: readonly InventoryFilter[] = [
  { id: 'all', label: '全部' },
  { id: 'farming', label: '農耕' },
  { id: 'materials', label: '材料' },
  { id: 'food', label: '食物' },
  { id: 'wearables', label: '服飾' },
  { id: 'other', label: '其他' },
];

const CATEGORY_GROUPS: Readonly<Record<Exclude<InventoryCategory, 'all' | 'other'>, readonly string[]>> = {
  farming: ['種子', '作物'],
  materials: ['材料', '採集', '礦石', '加工品', '合成品'],
  food: ['魚類', '動物產物', '料理'],
  wearables: ['裝飾'],
};

/** 格子數完全來自 Inventory.capacity；擴容後不會被固定的 24 格截斷。 */
export function inventorySlotCount(capacity: number): number {
  return Math.max(0, Math.floor(capacity));
}

export function isInventoryFull(entryCount: number, capacity: number): boolean {
  return entryCount >= capacity;
}

/** 分類只依 inventory-display 的 ItemKind 對應標籤；未知類型會保留在「其他」。 */
export function filterInventoryEntries(
  entries: readonly InventoryDisplayEntry[],
  category: InventoryCategory,
): InventoryDisplayEntry[] {
  if (category === 'all') return [...entries];
  if (category === 'other') {
    const knownCategories = new Set(Object.values(CATEGORY_GROUPS).flat());
    return entries.filter((entry) => !knownCategories.has(entry.category));
  }
  const categories = CATEGORY_GROUPS[category];
  return entries.filter((entry) => categories.includes(entry.category));
}

/** Inventory shell, category filters, capacity grid, and modal lifecycle. */
export class InventoryPanel {
  private readonly trigger: HTMLButtonElement;
  private readonly root: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly content: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly capacityLabel: HTMLElement;
  private readonly fullLabel: HTMLElement;
  private readonly emptyLabel: HTMLElement;
  private readonly dialog: PanelDialog;
  private category: InventoryCategory = 'all';
  private selectedKey: string | null = null;
  private dataProvider: (() => InventoryPanelData) | null = null;

  constructor(doc: Document) {
    this.trigger = required<HTMLButtonElement>(doc, '#hud-inventory');
    this.root = required(doc, '#inventory-panel');
    this.closeButton = required<HTMLButtonElement>(doc, '#inventory-close');
    this.content = required(doc, '#inventory-content');
    this.grid = required(doc, '#inventory-grid');
    this.capacityLabel = required(doc, '#inventory-capacity');
    this.fullLabel = required(doc, '#inventory-full');
    this.emptyLabel = required(doc, '#inventory-empty');
    this.detail = doc.createElement('aside');
    this.detail.id = 'inventory-detail';
    this.detail.className = 'inventory-detail';
    this.detail.setAttribute('aria-label', '物品詳情');
    this.detail.setAttribute('aria-live', 'polite');
    this.content.append(this.detail);
    applyGameUiTokens(this.root);
    this.dialog = new PanelDialog(this.root);

    for (const filter of FILTERS) {
      const button = required<HTMLButtonElement>(doc, `#inventory-filter-${filter.id}`);
      button.addEventListener('click', () => {
        this.category = filter.id;
        this.render();
      });
    }
    this.trigger.addEventListener('click', () => this.open());
    this.closeButton.addEventListener('click', () => this.close());
  }

  /** Source is queried on each open so the grid always reflects the latest session snapshot. */
  setDataProvider(provider: () => InventoryPanelData): void {
    this.dataProvider = provider;
  }

  isOpen(): boolean {
    return this.dialog.isOpen();
  }

  open(): void {
    this.render();
    this.dialog.open();
  }

  close(): void {
    this.dialog.close();
  }

  private render(): void {
    const data = this.dataProvider?.();
    if (!data) return;

    const visibleEntries = filterInventoryEntries(data.entries, this.category);
    const selectedEntry = visibleEntries.find((entry) => inventoryEntryKey(entry) === this.selectedKey) ?? null;
    if (!selectedEntry) this.selectedKey = null;
    const slots = inventorySlotCount(data.capacity);
    const full = isInventoryFull(data.entries.length, slots);
    this.capacityLabel.textContent = `${data.entries.length} / ${slots}`;
    this.capacityLabel.setAttribute('aria-label', `已使用 ${data.entries.length} 格，共 ${slots} 格`);
    this.fullLabel.hidden = !full;
    this.grid.dataset.full = String(full);
    this.emptyLabel.hidden = visibleEntries.length > 0;
    this.syncFilters();

    this.dialog.redraw(() => {
      const fragment = this.root.ownerDocument.createDocumentFragment();
      for (let slot = 0; slot < slots; slot += 1) {
        const entry = visibleEntries[slot];
        fragment.append(entry ? this.itemSlot(entry, data) : this.emptySlot());
      }
      this.grid.replaceChildren(fragment);
      this.renderDetail(selectedEntry, data);
    });
  }

  private syncFilters(): void {
    for (const filter of FILTERS) {
      const button = required<HTMLButtonElement>(this.root.ownerDocument, `#inventory-filter-${filter.id}`);
      button.setAttribute('aria-pressed', String(this.category === filter.id));
    }
  }

  private itemSlot(entry: InventoryDisplayEntry, data: InventoryPanelData): HTMLButtonElement {
    const doc = this.root.ownerDocument;
    const slot = doc.createElement('button');
    slot.type = 'button';
    slot.className = 'inventory-slot inventory-slot--item';
    slot.dataset.slotState = 'item';
    slot.dataset.itemId = entry.itemId;
    slot.dataset.quality = entry.quality;
    slot.dataset.count = String(entry.count);
    const key = inventoryEntryKey(entry);
    slot.dataset.focusKey = `inventory-entry:${key}`;
    slot.setAttribute('role', 'gridcell');
    slot.setAttribute('aria-label', `${entry.name}，${entry.qualityLabel}，${entry.count} 個`);
    slot.setAttribute('aria-selected', String(key === this.selectedKey));
    if (key === this.selectedKey) slot.classList.add('inventory-slot--selected');
    slot.addEventListener('click', () => {
      this.selectedKey = key;
      this.render();
    });

    const icon = doc.createElement('span');
    icon.className = 'inventory-slot-icon';
    const iconView = createItemIconView(
      { id: entry.itemId, label: entry.name, quantity: entry.count },
      data.resolveIcon(entry.itemId),
    );
    if (iconView.fallback) {
      icon.dataset.iconState = 'fallback';
      icon.dataset.diagnostic = iconView.diagnostic;
      icon.textContent = iconView.diagnostic === 'unknown-item' ? '？' : '✧';
      icon.setAttribute('aria-label', `圖示備援：${iconView.diagnostic}`);
    } else {
      icon.dataset.iconState = 'available';
      const image = doc.createElement('img');
      image.src = iconView.src;
      image.alt = '';
      image.loading = 'lazy';
      image.addEventListener('error', () => {
        icon.dataset.iconState = 'fallback';
        icon.dataset.diagnostic = 'icon-load-error';
        image.remove();
        icon.textContent = '✧';
        icon.setAttribute('aria-label', '圖示備援：icon-load-error');
      });
      icon.append(image);
    }

    const label = doc.createElement('span');
    label.className = 'inventory-slot-name';
    label.textContent = entry.name;
    const quantity = doc.createElement('span');
    quantity.className = 'inventory-slot-quantity';
    quantity.textContent = `×${entry.count}`;
    const quality = doc.createElement('span');
    quality.className = `inventory-slot-quality inventory-quality--${entry.quality}`;
    quality.textContent = entry.qualityLabel;

    slot.append(icon, label, quantity, quality);
    return slot;
  }

  private renderDetail(entry: InventoryDisplayEntry | null, data: InventoryPanelData): void {
    const doc = this.root.ownerDocument;
    this.detail.replaceChildren();
    this.detail.dataset.state = entry ? 'selected' : 'empty';
    delete this.detail.dataset.itemId;
    delete this.detail.dataset.quality;
    delete this.detail.dataset.count;

    const heading = doc.createElement('h3');
    heading.className = 'inventory-detail-heading';
    heading.textContent = '物品詳情';
    this.detail.append(heading);

    if (!entry) {
      const empty = doc.createElement('p');
      empty.className = 'inventory-detail-empty';
      empty.textContent = '選擇一件物品查看詳情。';
      this.detail.append(empty);
      return;
    }

    this.detail.dataset.itemId = entry.itemId;
    this.detail.dataset.quality = entry.quality;
    this.detail.dataset.count = String(entry.count);

    const icon = doc.createElement('span');
    icon.className = 'inventory-detail-icon';
    const iconView = createItemIconView(
      { id: entry.itemId, label: entry.name, quantity: entry.count },
      data.resolveIcon(entry.itemId),
    );
    if (iconView.fallback) {
      icon.dataset.iconState = 'fallback';
      icon.dataset.diagnostic = iconView.diagnostic;
      icon.textContent = iconView.diagnostic === 'unknown-item' ? '？' : '✧';
      icon.setAttribute('aria-label', `圖示備援：${iconView.diagnostic}`);
    } else {
      icon.dataset.iconState = 'available';
      const image = doc.createElement('img');
      image.src = iconView.src;
      image.alt = '';
      image.loading = 'lazy';
      image.addEventListener('error', () => {
        icon.dataset.iconState = 'fallback';
        icon.dataset.diagnostic = 'icon-load-error';
        image.remove();
        icon.textContent = '✧';
        icon.setAttribute('aria-label', '圖示備援：icon-load-error');
      });
      icon.append(image);
    }

    const name = doc.createElement('h4');
    name.className = 'inventory-detail-name';
    name.textContent = entry.name;
    const category = doc.createElement('p');
    category.className = 'inventory-detail-category';
    category.textContent = entry.category;
    const quality = doc.createElement('p');
    quality.className = `inventory-detail-quality inventory-quality--${entry.quality}`;
    quality.textContent = entry.qualityLabel;
    const count = doc.createElement('p');
    count.className = 'inventory-detail-count';
    count.textContent = `數量：${entry.count}`;

    this.detail.append(icon, name, category, quality, count);

    if (entry.sellPrice !== undefined) {
      const price = doc.createElement('p');
      price.className = 'inventory-detail-price';
      price.textContent = `售價：${entry.sellPrice} 銅幣／個`;
      this.detail.append(price);
    }

    if (entry.uses.length > 0) {
      const usesHeading = doc.createElement('h5');
      usesHeading.textContent = '用途';
      const uses = doc.createElement('ul');
      uses.className = 'inventory-detail-uses';
      for (const use of entry.uses) {
        const item = doc.createElement('li');
        item.textContent = use;
        uses.append(item);
      }
      this.detail.append(usesHeading, uses);
    }
  }

  private emptySlot(): HTMLElement {
    const slot = this.root.ownerDocument.createElement('div');
    slot.className = 'inventory-slot inventory-slot--empty';
    slot.dataset.slotState = 'empty';
    slot.setAttribute('role', 'gridcell');
    slot.setAttribute('aria-label', '空格');
    return slot;
  }
}

function inventoryEntryKey(entry: InventoryDisplayEntry): string {
  return JSON.stringify([entry.itemId, entry.quality, entry.count]);
}

function required<T extends HTMLElement = HTMLElement>(doc: Document, selector: string): T {
  const element = doc.querySelector<T>(selector);
  if (!element) throw new Error(`找不到背包介面元素：${selector}`);
  return element;
}
