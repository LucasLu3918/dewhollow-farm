import { describe, expect, it } from 'vitest';
import crops from '../../content/crops.json';
import npcs from '../../content/npcs.json';
import start from '../../content/start.json';
import tuning from '../../content/tuning.json';
import assets from '../../content/assets.json';
import farm from '../../content/maps/farm.json';
import village from '../../content/maps/village.json';
import { loadContent } from '../infrastructure/content/load-content';
import { MemorySaveRepository } from '../infrastructure/persistence/memory-save-repository';
import { createContentIndex } from './content-index';
import { GameSession } from './game-session';
import type { SaveRecord, SaveRepository } from './ports';
import { createNewGame, type GameState } from '../domain/game-state';

const { pack } = loadContent({ crops, npcs, maps: [farm, village], start, tuning, assets });
const index = createContentIndex(pack);

/** 測試輔助：把玩家放到指定位置後建立 session。 */
function sessionAt(player: GameState['player'], repo: SaveRepository) {
  const state = { ...createNewGame(pack, 1), player };
  return new GameSession(state, index, repo);
}

describe('GameSession', () => {
  it('starts a new game when no save exists', async () => {
    const repo = new MemorySaveRepository();
    const session = await GameSession.open(pack, index, repo, 1);
    expect(session.state.mapId).toBe('farm');
    expect(session.restored).toBe(false);
  });

  it('restores the saved state after a reload', async () => {
    const repo = new MemorySaveRepository();
    const first = sessionAt({ x: 3, y: 3, facing: 'right' }, repo);
    await first.dispatch({ type: 'interact' }); // 開墾面前的田地 (4,3)
    await first.save();

    const second = await GameSession.open(pack, index, repo, 1);
    expect(second.restored).toBe(true);
    expect(second.state).toEqual(first.state);
  });

  it('autosaves when the player sleeps', async () => {
    const repo = new MemorySaveRepository();
    const session = sessionAt({ x: 3, y: 1, facing: 'left' }, repo); // 床位 (2,1)
    const outcome = await session.dispatch({ type: 'interact' });
    expect(outcome.events).toContainEqual({ type: 'slept' });
    expect((await repo.load('slot-1'))?.state.calendar.day).toBe(2);
  });

  it('reports a real storage error instead of hiding it', async () => {
    const failing: SaveRepository = {
      load: async () => null,
      save: async (_record: SaveRecord) => {
        throw new Error('QuotaExceededError');
      },
    };
    const session = await GameSession.open(pack, index, failing, 1);
    await expect(session.save()).rejects.toThrow('QuotaExceededError');
  });

  it('turns an autosave failure into a visible message', async () => {
    const failing: SaveRepository = {
      load: async () => null,
      save: async () => {
        throw new Error('QuotaExceededError');
      },
    };
    const session = sessionAt({ x: 3, y: 1, facing: 'left' }, failing);
    const outcome = await session.dispatch({ type: 'interact' });
    expect(outcome.messages).toContain('自動存檔失敗：QuotaExceededError');
  });

  describe('play time', () => {
    /** 假時鐘：每次呼叫 tick() 前進指定毫秒。 */
    function clock(startMs = 1_000_000) {
      let now = startMs;
      return { now: () => now, tick: (ms: number) => void (now += ms) };
    }

    it('adds up the time between commands while the player is active', async () => {
      const time = clock();
      const repo = new MemorySaveRepository();
      const session = new GameSession(createNewGame(pack, 1), index, repo, { now: time.now });
      time.tick(4_000);
      await session.dispatch({ type: 'cycleTool' });
      time.tick(6_000);
      await session.dispatch({ type: 'cycleTool' });
      await session.save();
      expect(session.state.playtimeSeconds).toBe(10);
      expect((await repo.load('slot-1'))?.state.playtimeSeconds).toBe(10);
    });

    it('does not count a long idle gap as play time', async () => {
      const time = clock();
      const session = new GameSession(createNewGame(pack, 1), index, new MemorySaveRepository(), { now: time.now });
      time.tick(5_000);
      await session.dispatch({ type: 'cycleTool' });
      time.tick(10 * 60_000); // 離開座位十分鐘
      await session.dispatch({ type: 'cycleTool' });
      await session.save();
      expect(session.state.playtimeSeconds).toBe(5);
    });

    it('keeps counting from the saved total after a reload', async () => {
      const time = clock();
      const repo = new MemorySaveRepository();
      const first = new GameSession(createNewGame(pack, 1), index, repo, { now: time.now });
      time.tick(30_000);
      await first.dispatch({ type: 'cycleTool' });
      await first.save();

      const second = await GameSession.open(pack, index, repo, 1, 'slot-1', { now: time.now });
      time.tick(12_000);
      await second.dispatch({ type: 'cycleTool' });
      await second.save();
      expect(second.state.playtimeSeconds).toBe(42);
    });

    it('does not double count when saving twice in a row', async () => {
      const time = clock();
      const session = new GameSession(createNewGame(pack, 1), index, new MemorySaveRepository(), { now: time.now });
      time.tick(8_000);
      await session.dispatch({ type: 'cycleTool' });
      await session.save();
      await session.save();
      expect(session.state.playtimeSeconds).toBe(8);
    });
  });
});
