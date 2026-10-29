import { describe, expect, it } from 'vitest';
import assets from '../../../content/assets.json';
import cowbarn from '../../../content/maps/cowbarn.json';
import houseFull from '../../../content/maps/house-full.json';
import houseWing from '../../../content/maps/house-wing.json';
import type { MapDef } from '../../domain/content';
import type { AssetManifest } from '../assets/asset-manifest';
import { mapCoverageReport, type AuthoredMapFile } from './map-coverage';

const mapFiles = Object.entries(import.meta.glob('../../../content/maps/*.json', {
  eager: true,
  import: 'default',
}))
  .map(([key, map]) => ({ file: `content/maps/${key.split('/').at(-1)}`, map: map as AuthoredMapFile['map'] }))
  .sort((left, right) => left.file.localeCompare(right.file));

describe('mapCoverageReport', () => {
  it('covers every authored map, classifies house upgrades, and reports spawn-to-portal reachability', () => {
    const report = mapCoverageReport({
      files: mapFiles,
      assets: assets as unknown as AssetManifest,
      startMapId: 'farm',
      conditionalVariants: ['house-full', 'house-wing'],
    });

    expect(report.summary, JSON.stringify(report.issues)).toEqual({ totalMaps: 12, completeMaps: 12, coveragePercent: 100, portalCells: 22 });
    expect(report.maps.every((entry) => entry.idMatchesFile && entry.shape.valid && entry.spawn.valid)).toBe(true);
    expect(report.maps.every((entry) => entry.tileAssets.missing.length === 0)).toBe(true);
    expect(report.maps.find((entry) => entry.mapId === 'house-full')).toMatchObject({
      reachability: { fromStart: false, classification: 'conditional-variant' },
    });
    expect(report.maps.find((entry) => entry.mapId === 'house-wing')).toMatchObject({
      reachability: { fromStart: false, classification: 'conditional-variant' },
    });
    expect(report.maps.find((entry) => entry.mapId === 'house')).toMatchObject({
      reachability: { fromStart: true, classification: 'standard' },
    });
    expect(report.maps.every((entry) => entry.portals.every((portal) => portal.reachableInWorld
      || (entry.reachability.classification === 'conditional-variant' && portal.reachableFromSpawn)))).toBe(true);
    expect(report.maps.find((entry) => entry.mapId === 'farm')?.portals.find((portal) => portal.symbol === 'q')).toMatchObject({
      reachableFromSpawn: false,
      reachableInWorld: true,
    });
  });

  it('reports shape, spawn, tile asset, portal and local reachability gaps without changing the input', () => {
    const isolated = {
      id: 'isolated', name: 'Isolated', width: 3, height: 2,
      rows: ['#D##', '###'],
      legend: {
        '#': { kind: 'wall' as const },
        '.': { kind: 'grass' as const },
        D: { kind: 'door' as const, to: 'missing', spawn: { x: 5, y: 5 } },
      },
      spawn: { x: 0, y: 0 },
    } as unknown as MapDef;
    const original = structuredClone(isolated);
    const report = mapCoverageReport({
      files: [{ file: 'content/maps/not-isolated.json', map: isolated }],
      assets: { version: 1, assets: [] } as unknown as AssetManifest,
      startMapId: 'isolated',
    });

    expect(report.summary).toMatchObject({ totalMaps: 1, completeMaps: 0, coveragePercent: 0 });
    expect(report.maps[0]).toMatchObject({
      idMatchesFile: false,
      shape: { valid: false, invalidRows: [0] },
      spawn: { valid: false },
      tileAssets: { missing: ['tile.door', 'tile.grass', 'tile.wall'] },
      portals: [{ destinationExists: false, landingValid: false, reachableFromSpawn: false, reachableInWorld: false }],
    });
    expect(isolated).toEqual(original);
  });

  it('flags duplicate map ids, missing start maps, and unknown map row symbols', () => {
    const map = { ...cowbarn, rows: ['?????', ...cowbarn.rows.slice(1)] } as unknown as MapDef;
    const duplicate = { ...houseFull, id: 'cowbarn' } as unknown as MapDef;
    const report = mapCoverageReport({
      files: [
        { file: 'content/maps/cowbarn.json', map },
        { file: 'content/maps/duplicate.json', map: duplicate },
      ],
      assets: assets as unknown as AssetManifest,
      startMapId: 'does-not-exist',
    });

    expect(report.summary.completeMaps).toBe(0);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'duplicate-map-id', mapId: 'cowbarn' }),
      expect.objectContaining({ code: 'missing-start-map', mapId: null }),
      expect.objectContaining({ code: 'unknown-symbol', mapId: 'cowbarn' }),
    ]));
  });
});
