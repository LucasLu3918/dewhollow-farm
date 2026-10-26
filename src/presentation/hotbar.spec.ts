import { describe, expect, it } from 'vitest';
import type { ContentIndex } from '../application/content-index';
import type { GameState, HotbarItem } from '../domain/game-state';
import { createInventory } from '../domain/inventory';
import { hotbarCommandForSlot } from './hotbar';

const index = { cropIds: () => ['moon-bean'] } as ContentIndex;

function state(inventory = createInventory(24)): GameState {
  return {
    inventory,
    hotbar: [null, null, null, null],
    tool: 'hoe',
    selectedSeed: 'moon-bean',
  } as GameState;
}

describe('hotbarCommandForSlot', () => {
  it('returns the existing tool or owned-seed selection command', () => {
    const current = state({
      capacity: 24,
      stacks: [{ itemId: 'seed.moon-bean', quality: 'normal', count: 2 }],
    });
    expect(hotbarCommandForSlot({ kind: 'tool', tool: 'axe' }, current, index)).toEqual({ type: 'takeTool', tool: 'axe' });
    expect(hotbarCommandForSlot({ kind: 'seed', cropId: 'moon-bean' }, current, index)).toEqual({ type: 'selectSeed', cropId: 'moon-bean' });
  });

  it.each([
    ['empty', null],
    ['invalid seed', { kind: 'seed', cropId: 'missing-crop' }],
  ] as Array<[string, HotbarItem]>)('does not produce a command for an %s slot', (_label, item) => {
    expect(hotbarCommandForSlot(item, state(), index)).toBeNull();
  });

  it('does not produce a command for a depleted seed slot', () => {
    const current = state({ capacity: 24, stacks: [{ itemId: 'seed.moon-bean', quality: 'normal', count: 0 }] });
    expect(hotbarCommandForSlot({ kind: 'seed', cropId: 'moon-bean' }, current, index)).toBeNull();
    expect(current.inventory.stacks[0]?.count).toBe(0);
  });
});
