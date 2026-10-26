import { describe, expect, it } from 'vitest';
import { createItemIconLoadError, createItemIconView, type ItemIconItem } from './item-icon';

const item: ItemIconItem = { id: 'item.sweet-radish', label: '甜蘿蔔', quantity: 7 };

describe('item icon presentation', () => {
  it('shows a known icon with the original item identity and quantity', () => {
    expect(createItemIconView(item, { status: 'available', src: '/assets/items/sweet-radish.png' })).toEqual({
      id: item.id,
      label: item.label,
      quantity: item.quantity,
      src: '/assets/items/sweet-radish.png',
      fallback: false,
    });
  });

  it('shows a diagnostic fallback when the icon is missing', () => {
    expect(createItemIconView(item, { status: 'missing', diagnostic: 'missing-icon' })).toEqual({
      id: item.id,
      label: item.label,
      quantity: item.quantity,
      fallback: true,
      diagnostic: 'missing-icon',
    });
  });

  it('shows a distinct diagnostic fallback for an unknown item ID', () => {
    expect(createItemIconView(item, { status: 'missing', diagnostic: 'unknown-item' })).toMatchObject({
      fallback: true,
      diagnostic: 'unknown-item',
    });
  });

  it('preserves item ID, label and quantity when image loading fails', () => {
    expect(createItemIconLoadError(item)).toEqual({
      id: item.id,
      label: item.label,
      quantity: item.quantity,
      fallback: true,
      diagnostic: 'icon-load-error',
    });
  });
});
