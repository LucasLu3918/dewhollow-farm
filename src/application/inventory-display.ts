import type { Inventory } from '../domain/inventory';
import type { ItemKind, Quality } from '../domain/items';
import { priceWithQuality } from '../domain/pricing';
import type { ContentIndex } from './content-index';

const CATEGORY_LABELS: Record<ItemKind, string> = {
  seed: '種子',
  crop: '作物',
  material: '材料',
  forage: '採集',
  ore: '礦石',
  fish: '魚類',
  animal: '動物產物',
  dish: '料理',
  processed: '加工品',
  craft: '合成品',
  building: '建築改建',
  decor: '裝飾',
  recipe: '配方',
};

const QUALITY_LABELS: Record<Quality, string> = {
  normal: '普通',
  good: '優良',
  fine: '精良',
};

export interface InventoryDisplayEntry {
  itemId: string;
  name: string;
  category: string;
  count: number;
  quality: Quality;
  qualityLabel: string;
  /** 沒有價格的物品不可出貨，因此不會有此欄位。 */
  sellPrice?: number;
  /** 由內容配方或 ItemDef 明確支援的操作與用途。 */
  uses: string[];
}

function categoryLabel(kind: ItemKind): string {
  const label = CATEGORY_LABELS[kind];
  if (label === undefined) throw new Error(`不支援的物品類別：${String(kind)}`);
  return label;
}

function usesOf(itemId: string, index: ContentIndex): string[] {
  const uses: string[] = [];
  for (const recipe of index.recipes) {
    if (recipe.ingredients[itemId] !== undefined) uses.push(`料理：${recipe.name}`);
  }
  for (const recipe of index.processingRecipes) {
    if (recipe.ingredients[itemId] !== undefined) uses.push(`加工：${recipe.name}`);
  }
  for (const recipe of index.craftingRecipes) {
    if (recipe.ingredients[itemId] !== undefined) uses.push(`合成：${recipe.name}`);
  }
  return uses;
}

/** 依真實背包堆疊與內容索引建立可呈現資料；未知物品沿用 ContentIndex 的明確錯誤。 */
export function inventoryDisplay(inventory: Inventory, index: ContentIndex): InventoryDisplayEntry[] {
  return inventory.stacks.map((stack) => {
    const item = index.item(stack.itemId);
    const entry: InventoryDisplayEntry = {
      itemId: stack.itemId,
      name: item.name,
      category: categoryLabel(item.kind),
      count: stack.count,
      quality: stack.quality,
      qualityLabel: QUALITY_LABELS[stack.quality],
      uses: usesOf(item.id, index),
    };

    if (item.sellPrice !== undefined) entry.sellPrice = priceWithQuality(item.sellPrice, stack.quality);
    if (item.kind === 'seed') entry.uses.unshift('播種');
    if (item.kind === 'decor') {
      entry.uses.unshift(item.wearable ? '穿戴' : '擺放');
    }
    if (item.kind === 'dish') entry.uses.unshift('食用');
    if (item.kind === 'recipe') entry.uses.unshift('學習配方');

    return entry;
  });
}
