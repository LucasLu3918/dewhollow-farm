import { describe, expect, it } from 'vitest';
import { isWalkable, neighbor, tileAt } from './world';
import type { MapDef } from './content';

const map: MapDef = {
  id: 'test',
  name: '測試',
  width: 3,
  height: 2,
  rows: ['#f.', 'B=D'],
  legend: {
    '#': { kind: 'wall' },
    f: { kind: 'field' },
    '.': { kind: 'grass' },
    B: { kind: 'bed' },
    '=': { kind: 'path' },
    D: { kind: 'door', to: 'other', spawn: { x: 1, y: 1 } },
  },
  spawn: { x: 2, y: 0 },
  npcs: [],
};

describe('world', () => {
  it('resolves tile kinds from the map legend', () => {
    expect(tileAt(map, 0, 0)?.kind).toBe('wall');
    expect(tileAt(map, 1, 0)?.kind).toBe('field');
    expect(tileAt(map, 2, 1)?.kind).toBe('door');
  });

  it('returns null outside the map', () => {
    expect(tileAt(map, -1, 0)).toBeNull();
    expect(tileAt(map, 3, 0)).toBeNull();
  });

  it('treats walls, beds and shipping boxes as blocked', () => {
    expect(isWalkable('wall')).toBe(false);
    expect(isWalkable('bed')).toBe(false);
    expect(isWalkable('shipbox')).toBe(false);
    expect(isWalkable('field')).toBe(true);
    expect(isWalkable('door')).toBe(true);
  });

  it('moves one tile in a direction', () => {
    expect(neighbor({ x: 1, y: 1 }, 'up')).toEqual({ x: 1, y: 0 });
    expect(neighbor({ x: 1, y: 1 }, 'left')).toEqual({ x: 0, y: 1 });
  });
});
