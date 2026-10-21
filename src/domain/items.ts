import type { CropDef } from './content';
import { sellPriceOf } from './pricing';

/** 種子與作物由作物衍生；木材、野薄荷、礦石是獨立定義的（content/items.json）。 */
export type ItemKind = 'seed' | 'crop' | 'material' | 'forage' | 'ore' | 'fish' | 'animal' | 'dish' | 'processed' | 'craft';

export type Quality = 'normal' | 'good' | 'fine';

export const QUALITIES: readonly Quality[] = ['normal', 'good', 'fine'];

export const DEFAULT_MAX_STACK = 99;

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  /** 單一格子最多堆疊幾個。 */
  maxStack: number;
  /** 出貨底價；沒有則不能出貨（例如種子）。品質倍率另計。 */
  sellPrice?: number;
  /** 種子與作物對應的作物 id。 */
  cropId?: string;
}

/** 背包與出貨箱中的一疊物品。同一個物品與品質的組合只會合併成一疊（超過上限才拆）。 */
export interface ItemStack {
  itemId: string;
  quality: Quality;
  count: number;
}

export function seedItemId(cropId: string): string {
  return `seed.${cropId}`;
}

export function cropItemId(cropId: string): string {
  return `crop.${cropId}`;
}

/** 每種作物衍生出種子與收成兩個物品，避免在 content 裡重複維護。 */
export function cropItems(crops: readonly CropDef[]): ItemDef[] {
  return crops.flatMap((crop) => [
    {
      id: seedItemId(crop.id),
      name: `${crop.name}種子`,
      kind: 'seed' as const,
      maxStack: DEFAULT_MAX_STACK,
      cropId: crop.id,
    },
    {
      id: cropItemId(crop.id),
      name: crop.name,
      kind: 'crop' as const,
      maxStack: DEFAULT_MAX_STACK,
      sellPrice: sellPriceOf(crop.seedPrice, crop.growthDays),
      cropId: crop.id,
    },
  ]);
}
