import type { ItemIconResolution } from '../infrastructure/assets/asset-manifest';

export interface ItemIconItem {
  id: string;
  label: string;
  quantity: number;
}

export type ItemIconDiagnostic = 'missing-icon' | 'unknown-item' | 'icon-load-error';

export type ItemIconView =
  | { id: string; label: string; quantity: number; src: string; fallback: false }
  | { id: string; label: string; quantity: number; fallback: true; diagnostic: ItemIconDiagnostic };

/** Presentation data for an item icon; labels are plain text for the DOM caller. */
export function createItemIconView(item: ItemIconItem, resolution: ItemIconResolution): ItemIconView {
  if (resolution.status === 'available') {
    return { id: item.id, label: item.label, quantity: item.quantity, src: resolution.src, fallback: false };
  }
  return {
    id: item.id,
    label: item.label,
    quantity: item.quantity,
    fallback: true,
    diagnostic: resolution.diagnostic,
  };
}

/** Use from an image error handler to replace a broken source without losing item context. */
export function createItemIconLoadError(item: ItemIconItem): ItemIconView {
  return {
    id: item.id,
    label: item.label,
    quantity: item.quantity,
    fallback: true,
    diagnostic: 'icon-load-error',
  };
}
