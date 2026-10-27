import { describe, expect, it } from 'vitest';
import type { MapDef } from '../domain/content';
import farm from '../../content/maps/farm.json';
import { groundLayerFor, isGroundLayer } from './map-layers';

const farmMap = farm as MapDef;

describe('groundLayerFor', () => {
  it('prefers an explicit ground under an object over neighboring terrain', () => {
    const map: MapDef = {
      id: 'test',
      name: 'test',
      width: 3,
      height: 1,
      rows: ['fWf'],
      legend: {
        f: { kind: 'field' },
        W: { kind: 'fence', ground: 'grass' },
      },
      spawn: { x: 0, y: 0 },
    };

    expect(groundLayerFor(map, 1, 0)).toBe('grass');
  });

  it('uses grass beneath both mirrored greenhouse fence sides', () => {
    expect(groundLayerFor(farmMap, 27, 22)).toBe('grass');
    expect(groundLayerFor(farmMap, 33, 22)).toBe('grass');
  });

  it('keeps wall tiles as objects over an opaque neighboring ground layer', () => {
    expect(isGroundLayer('wall')).toBe(false);
    expect(groundLayerFor(farmMap, 0, 0)).not.toBe('wall');
  });
});
