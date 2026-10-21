import { describe, expect, it } from 'vitest';
import crops from '../../../content/crops.json';
import npcs from '../../../content/npcs.json';
import start from '../../../content/start.json';
import tuning from '../../../content/tuning.json';
import assets from '../../../content/assets.json';
import rigs from '../../../content/rigs.json';
import companions from '../../../content/companions.json';
import farm from '../../../content/maps/farm.json';
import village from '../../../content/maps/village.json';
import { ContentError, loadContent, type RawContentFiles } from './load-content';

function shipped(overrides: Partial<RawContentFiles> = {}): RawContentFiles {
  return { crops, npcs, maps: [farm, village], start, tuning, assets, rigs, companions, ...overrides };
}

describe('loadContent with shipped content', () => {
  it('loads the MVP content without problems', () => {
    const { pack } = loadContent(shipped());
    expect(pack.crops.map((c) => c.id)).toEqual([
      'dew-grass',
      'moon-bean',
      'sweet-radish',
      'star-pepper',
      'dusk-potato',
      'silver-wheat',
    ]);
    expect(pack.maps.map((m) => m.id)).toEqual(['farm', 'village']);
    expect(pack.start.mapId).toBe('farm');
  });
});

describe('loadContent with rigs', () => {
  it('returns the rigs beside the assets', () => {
    const loaded = loadContent(shipped());
    expect(loaded.rigs.rigs.map((r) => r.id)).toEqual(['player', 'maomao', 'cat', 'marsupial']);
    expect(loaded.companions.companions.map((c) => c.id)).toEqual(['cat', 'marsupial']);
  });

  it('reports a rig that points at a missing asset together with the other problems', () => {
    const broken = { ...rigs, rigs: [{ ...rigs.rigs[0], views: { ...(rigs.rigs[0] as { views: object }).views, up: 'player.nope' } }, ...rigs.rigs.slice(1)] };
    try {
      loadContent(shipped({ rigs: broken }));
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ContentError);
      expect((error as ContentError).problems).toContain('rig player 的 up 素材 player.nope 不存在');
    }
  });

  it('reports a companion that points at a rig or a map that does not exist', () => {
    const broken = {
      ...companions,
      companions: [
        { id: 'cat', rig: 'dog', follows: 'player' },
        { id: 'marsupial', rig: 'marsupial', home: { mapId: 'nowhere', x: 1, y: 1 } },
      ],
    };
    try {
      loadContent(shipped({ companions: broken }));
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ContentError);
      const problems = (error as ContentError).problems;
      expect(problems).toContain('夥伴 cat 的 rig dog 不存在');
      expect(problems).toContain('夥伴 marsupial 的 home 地圖 nowhere 不存在');
    }
  });

  it('rejects a malformed companions file', () => {
    expect(() => loadContent(shipped({ companions: { version: 1, companions: [{ id: 'x' }] } }))).toThrow();
  });

  it('rejects a malformed rigs file', () => {
    expect(() => loadContent(shipped({ rigs: { version: 1, rigs: [{ id: 'x' }] } }))).toThrow();
  });
});

describe('loadContent validation', () => {
  it('rejects a map row whose length does not match width', () => {
    const broken = { ...farm, rows: [...farm.rows.slice(0, 1), '#.B#', ...farm.rows.slice(2)] };
    expect(() => loadContent(shipped({ maps: [broken, village] }))).toThrow(ContentError);
    try {
      loadContent(shipped({ maps: [broken, village] }));
    } catch (error) {
      expect((error as ContentError).problems.join('\n')).toContain('第 1 列長度 4');
    }
  });

  it('rejects an NPC placed on a blocked tile', () => {
    const blocked = { ...village, npcs: [{ npcId: 'maomao', x: 0, y: 0 }] };
    try {
      loadContent(shipped({ maps: [farm, blocked] }));
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ContentError);
      expect((error as ContentError).problems.join('\n')).toContain('不可行走的格子 (0,0)');
    }
  });

  it('rejects a door that points to a missing map', () => {
    const broken = {
      ...farm,
      legend: { ...farm.legend, D: { kind: 'door' as const, to: 'nowhere', spawn: { x: 1, y: 1 } } },
    };
    try {
      loadContent(shipped({ maps: [broken, village] }));
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as ContentError).problems.join('\n')).toContain('指向不存在的地圖 nowhere');
    }
  });

  it('rejects a missing placeholder asset for a crop', () => {
    const trimmed = { ...assets, assets: assets.assets.filter((a) => a.id !== 'crop.moon-bean') };
    try {
      loadContent(shipped({ assets: trimmed }));
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as ContentError).problems).toContain('素材清單缺少 crop.moon-bean');
    }
  });

  it('rejects a starting seed that is not defined as a crop', () => {
    expect(() => loadContent(shipped({ start: { ...start, seeds: { ghost: 1 } } }))).toThrow(/起始種子 ghost 不存在/);
  });

  it('reports schema errors from malformed JSON', () => {
    expect(() => loadContent(shipped({ crops: [{ id: 'x' }] }))).toThrow();
  });
});
