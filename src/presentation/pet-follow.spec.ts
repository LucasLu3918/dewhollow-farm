import { describe, expect, it } from 'vitest';
import type { MapDef } from '../domain/content';
import { nextPetTile, placeBeside } from './pet-follow';

describe('nextPetTile', () => {
  it('steps onto the tile the player has just left', () => {
    expect(nextPetTile({ x: 3, y: 3 }, { x: 3, y: 4 }, { x: 3, y: 2 })).toEqual({ x: 3, y: 3 });
    expect(nextPetTile({ x: 3, y: 3 }, { x: 2, y: 3 }, { x: 4, y: 3 })).toEqual({ x: 3, y: 3 });
  });

  it('stays put when the player only turned on the spot', () => {
    expect(nextPetTile({ x: 3, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 2 })).toEqual({ x: 3, y: 2 });
  });

  it('takes the vacated tile when the player walks onto the pet, so they swap places', () => {
    expect(nextPetTile({ x: 3, y: 3 }, { x: 3, y: 4 }, { x: 3, y: 4 })).toEqual({ x: 3, y: 3 });
  });

  it('keeps trailing exactly one step behind a whole walk', () => {
    let pet = { x: 1, y: 1 };
    let player = { x: 2, y: 1 };
    const path = [
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
    ];
    const trail: { x: number; y: number }[] = [];
    for (const next of path) {
      pet = nextPetTile(player, next, pet);
      trail.push(pet);
      player = next;
    }
    expect(trail).toEqual([{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }]);
  });

  it('never returns an object it shares with its arguments', () => {
    const before = { x: 3, y: 3 };
    const result = nextPetTile(before, { x: 3, y: 4 }, { x: 3, y: 2 });
    expect(result).not.toBe(before);
  });
});

describe('placeBeside', () => {
  /** 5×4：外圈是牆，裡面 3×2 是草地；(2,3) 是門。 */
  const map: MapDef = {
    id: 'room',
    name: '房間',
    width: 5,
    height: 4,
    rows: ['#####', '#...#', '#...#', '##D##'],
    legend: { '#': { kind: 'wall' }, '.': { kind: 'grass' }, D: { kind: 'door', to: 'farm', spawn: { x: 1, y: 1 } } },
    spawn: { x: 2, y: 1 },
    npcs: [],
  };

  it('prefers the tile behind the player', () => {
    // 面向下時，「後面」是上方一格。
    expect(placeBeside(map, { x: 2, y: 2 }, 'down')).toEqual({ x: 2, y: 1 });
    expect(placeBeside(map, { x: 2, y: 1 }, 'up')).toEqual({ x: 2, y: 2 });
    expect(placeBeside(map, { x: 1, y: 1 }, 'left')).toEqual({ x: 2, y: 1 });
  });

  it('moves to a side when behind is not free, trying the clockwise side first', () => {
    // 玩家在 (2,1) 面向下：後面 (2,0) 是牆。順時針的旁邊（面向下時是左）(1,1) 可站。
    expect(placeBeside(map, { x: 2, y: 1 }, 'down')).toEqual({ x: 1, y: 1 });
    // 左邊也被擋住時換另一邊。
    expect(placeBeside(map, { x: 2, y: 1 }, 'down', new Set(['1,1']))).toEqual({ x: 3, y: 1 });
  });

  it('falls back to the tile ahead as a last resort', () => {
    expect(placeBeside(map, { x: 2, y: 1 }, 'down', new Set(['1,1', '3,1']))).toEqual({ x: 2, y: 2 });
  });

  it('never picks a wall, a door, the player, a villager, or a blocked tile', () => {
    // 玩家在 (2,2)，面向上：後面 (2,3) 是門，不能站；旁邊 (3,2)、(1,2)；
    expect(placeBeside(map, { x: 2, y: 2 }, 'up')).not.toEqual({ x: 2, y: 3 });
    const withVillager: MapDef = { ...map, npcs: [{ npcId: 'mira', x: 1, y: 2 }] };
    const spot = placeBeside(withVillager, { x: 2, y: 2 }, 'up');
    expect(spot).not.toEqual({ x: 1, y: 2 });
    expect(spot).not.toEqual({ x: 2, y: 2 });
  });

  it('returns null when there is nowhere to stand', () => {
    const lonely: MapDef = { ...map, rows: ['#####', '#.###', '#####', '##D##'], width: 5, height: 4 };
    expect(placeBeside(lonely, { x: 1, y: 1 }, 'down')).toBeNull();
  });

  it('is deterministic: the same situation always gives the same tile', () => {
    expect(placeBeside(map, { x: 2, y: 1 }, 'down')).toEqual(placeBeside(map, { x: 2, y: 1 }, 'down'));
  });
});
