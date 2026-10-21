import { describe, expect, it } from 'vitest';
import crops from '../../../content/crops.json';
import npcs from '../../../content/npcs.json';
import start from '../../../content/start.json';
import tuning from '../../../content/tuning.json';
import farm from '../../../content/maps/farm.json';
import village from '../../../content/maps/village.json';
import { createNewGame } from '../../domain/game-state';
import { loadContent } from '../content/load-content';
import assets from '../../../content/assets.json';
import { SaveFormatError, parseSaveRecord } from './save-schema';

const { pack } = loadContent({ crops, npcs, maps: [farm, village], start, tuning, assets });

function record(state: unknown) {
  return { slot: 'slot-1', savedAt: '2026-10-21T00:00:00.000Z', state };
}

describe('save schema', () => {
  it('accepts a new game state and returns it unchanged', () => {
    const state = createNewGame(pack, 1);
    expect(parseSaveRecord(record(state)).state).toEqual(state);
  });

  it('rejects an unknown tool with the field path', () => {
    const state = { ...createNewGame(pack, 1), tool: 'bow' };
    try {
      parseSaveRecord(record(state));
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SaveFormatError);
      expect((error as Error).message).toContain('存檔內容格式錯誤於 tool');
    }
  });

  it('rejects a negative gold amount', () => {
    expect(() => parseSaveRecord(record({ ...createNewGame(pack, 1), gold: -1 }))).toThrow(SaveFormatError);
  });

  it('rejects a record without a slot', () => {
    expect(() => parseSaveRecord({ savedAt: 'x', state: createNewGame(pack, 1) })).toThrow(SaveFormatError);
  });
});
