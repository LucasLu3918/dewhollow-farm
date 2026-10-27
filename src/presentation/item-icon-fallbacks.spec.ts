import { describe, expect, it } from 'vitest';
import assets from '../../content/assets.json';
import crops from '../../content/crops.json';
import fish from '../../content/fish.json';
import items from '../../content/items.json';
import recipes from '../../content/recipes.json';
import { ITEM_ICON_FALLBACKS, ITEM_ICON_FALLBACK_PRESENTATION, type ItemIconFallbackKind } from './item-icon-fallbacks';

const bagItems = [
  ...items.items.filter(({ kind }) => kind !== 'building' && kind !== 'recipe'),
  ...crops.flatMap(({ id }) => [
    { id: `seed.${id}`, kind: 'seed' },
    { id: `crop.${id}`, kind: 'crop' },
  ]),
  ...fish.fish.map(({ id }) => ({ id: `fish.${id}`, kind: 'fish' })),
  ...recipes.recipes.map(({ id }) => ({ id: `dish.${id}`, kind: 'dish' })),
];

describe('inventory item icon fallback coverage', () => {
  it('assigns every bag item exactly one approved PNG or typed fallback', () => {
    const dedicatedIconIds = Object.keys(assets.itemIcons ?? {});
    const fallbackIds = Object.keys(ITEM_ICON_FALLBACKS);
    const assignments = [...dedicatedIconIds, ...fallbackIds];
    const bagItemIds = bagItems.map(({ id }) => id);

    expect(bagItemIds).toHaveLength(81);
    expect(new Set(bagItemIds).size).toBe(bagItemIds.length);
    expect(new Set(assignments).size).toBe(assignments.length);
    expect([...assignments].sort()).toEqual([...bagItemIds].sort());

    for (const item of bagItems) {
      if (dedicatedIconIds.includes(item.id)) continue;
      expect(ITEM_ICON_FALLBACKS[item.id as keyof typeof ITEM_ICON_FALLBACKS], item.id).toBe(item.kind);
    }
  });

  it('uses a presentation symbol and label for every typed fallback kind', () => {
    const fallbackKinds = new Set<ItemIconFallbackKind>(Object.values(ITEM_ICON_FALLBACKS));

    expect(fallbackKinds.size).toBeGreaterThan(0);
    for (const kind of fallbackKinds) {
      expect(ITEM_ICON_FALLBACK_PRESENTATION[kind].symbol).toBeTruthy();
      expect(ITEM_ICON_FALLBACK_PRESENTATION[kind].label).toBeTruthy();
    }
  });
});
