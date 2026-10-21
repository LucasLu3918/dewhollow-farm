import { describe, expect, it } from 'vitest';
import crops from '../../../content/crops.json';
import npcs from '../../../content/npcs.json';
import start from '../../../content/start.json';
import tuning from '../../../content/tuning.json';
import assets from '../../../content/assets.json';
import rigs from '../../../content/rigs.json';
import companions from '../../../content/companions.json';
import tools from '../../../content/tools.json';
import sounds from '../../../content/sounds.json';
import music from '../../../content/music.json';
import terrain from '../../../content/terrain.json';
import weather from '../../../content/weather.json';
import items from '../../../content/items.json';
import shops from '../../../content/shops.json';
import fish from '../../../content/fish.json';
import animals from '../../../content/animals.json';
import recipes from '../../../content/recipes.json';
import processing from '../../../content/processing.json';
import crafting from '../../../content/crafting.json';
import talents from '../../../content/talents.json';
import forest from '../../../content/maps/forest.json';
import lake from '../../../content/maps/lake.json';
import house from '../../../content/maps/house.json';
import mineEntrance from '../../../content/maps/mine-entrance.json';
import coop from '../../../content/maps/coop.json';
import pasture from '../../../content/maps/pasture.json';
import cowbarn from '../../../content/maps/cowbarn.json';
import farm from '../../../content/maps/farm.json';
import village from '../../../content/maps/village.json';
import { ContentError, loadContent, type RawContentFiles } from './load-content';

function shipped(overrides: Partial<RawContentFiles> = {}): RawContentFiles {
  return { crops, npcs, maps: [farm, village, forest, lake, house, mineEntrance, coop, pasture, cowbarn], start, tuning, assets, rigs, companions, tools, sounds, music, terrain, weather, items, shops, fish, animals, recipes, processing, crafting, talents, ...overrides };
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
    expect(pack.maps.map((m) => m.id)).toEqual(['farm', 'village', 'forest', 'lake', 'house', 'mine-entrance', 'coop', 'pasture', 'cowbarn']);
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

  it('returns the tools beside the rigs', () => {
    expect(loadContent(shipped()).tools.tools.map((t) => t.id)).toEqual(['hoe', 'can', 'seedbag', 'axe', 'pick', 'rod', 'sickle']);
  });

  it('reports a tool whose image is missing together with the other problems', () => {
    const broken = { ...tools, tools: [{ ...tools.tools[0], asset: 'tool.nope' }, ...tools.tools.slice(1)] };
    try {
      loadContent(shipped({ tools: broken }));
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ContentError);
      expect((error as ContentError).problems).toContain('工具 hoe 的素材 tool.nope 不存在');
    }
  });

  it('rejects a malformed tools file', () => {
    expect(() => loadContent(shipped({ tools: { version: 1, tools: [{ id: 'x' }] } }))).toThrow();
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

describe('loadContent with processing recipes', () => {
  it('rejects a processing recipe whose ingredient or product does not exist', () => {
    const bad = {
      version: 1 as const,
      recipes: [
        { id: 'x', name: '壞掉的醃漬', ingredients: { 'crop.nope': 1 }, output: 'nope', days: 1, level: 0 },
      ],
    };
    let problems: string[] = [];
    try {
      loadContent(shipped({ processing: bad }));
    } catch (error) {
      if (error instanceof ContentError) problems = error.problems;
    }
    expect(problems).toContain('加工配方 x 的材料 crop.nope 不存在');
    expect(problems).toContain('加工配方 x 的成品 nope 不存在');
  });

  it('accepts the shipped processing recipes', () => {
    expect(() => loadContent(shipped())).not.toThrow();
  });
});

describe('loadContent with sounds and terrain', () => {
  it('returns the sound catalog and the footstep style of every walkable tile', () => {
    const loaded = loadContent(shipped());
    expect(loaded.sounds.master).toBeGreaterThan(0);
    expect(loaded.terrain.terrains.map((t) => t.kind).sort()).toEqual(['field', 'floor', 'forage', 'grass', 'path', 'shore', 'snow', 'stairs']);
  });

  it('reports a footstep that points at a sound that does not exist', () => {
    const broken = { ...terrain, terrains: terrain.terrains.map((t) => (t.kind === 'grass' ? { ...t, footstep: { ...t.footstep, sound: 'step.nope' } } : t)) };
    try {
      loadContent(shipped({ terrain: broken }));
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ContentError);
      expect((error as ContentError).problems).toContain('地形 grass 的腳步音效 step.nope 不存在');
    }
  });

  it('reports a walkable tile that has no footstep style', () => {
    const missing = { ...terrain, terrains: terrain.terrains.filter((t) => t.kind !== 'path') };
    try {
      loadContent(shipped({ terrain: missing }));
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ContentError);
      expect((error as ContentError).problems).toContain('地圖上的地形 path 沒有腳步設定（content/terrain.json）');
    }
  });

  it('rejects a malformed sound recipe', () => {
    expect(() => loadContent(shipped({ sounds: { version: 1, master: 0.5, sounds: { click: { voices: [{ wave: 'organ' }] } } } }))).toThrow();
  });
});
