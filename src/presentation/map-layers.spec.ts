import { describe, expect, it } from 'vitest';
import type { MapDef } from '../domain/content';
import farm from '../../content/maps/farm.json';
import greenhouse from '../../content/maps/greenhouse.json';
import { groundLayerFor, isGroundLayer } from './map-layers';

const farmMap = farm as MapDef;
const greenhouseMap = greenhouse as MapDef;

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

  it('uses a stable floor beneath the standalone greenhouse walls', () => {
    expect(groundLayerFor(greenhouseMap, 0, 3)).toBe('floor');
    expect(groundLayerFor(greenhouseMap, 11, 3)).toBe('floor');
  });

  it('keeps wall tiles as objects over an opaque neighboring ground layer', () => {
    expect(isGroundLayer('wall')).toBe(false);
    expect(groundLayerFor(farmMap, 0, 0)).not.toBe('wall');
  });
});
