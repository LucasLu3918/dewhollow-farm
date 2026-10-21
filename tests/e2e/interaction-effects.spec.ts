import { expect, test, type Page } from '@playwright/test';

/**
 * 互動效果（docs/ART_PIPELINE.md 第 5 節）：
 * - 工具揮動：開墾、澆水、播種各拿出自己的工具圖，揮動的幅度與方向由 tool-swing.ts 決定（有單元測試）；
 *   粒子與鏡頭微震落在「命中那一刻」，不是動作一開始；
 * - 表情氣泡：搭話、被拒絕、睡覺時在頭上彈出，再消失。
 * 讀取方式見 window.__dewhollow（僅開發模式）。
 */
interface ToolInfo {
  id: string;
  rotation: number;
  scale: number;
}

interface Actor {
  id: string;
  tileX: number;
  tileY: number;
  top: number;
  pose: { y: number };
  tool: ToolInfo | null;
  busy: boolean;
}

interface Emote {
  who: string;
  kind: string;
  x: number;
  y: number;
  scale: number;
  alpha: number;
}

interface LogEntry {
  name: string;
  at: number;
}

const SWING_MS = 420; // MapScene 的 SWING_DURATION_MS
const CHOP_IMPACT = 0.55; // tool-swing.ts 的 impactAt('chop')

async function actors(page: Page): Promise<Actor[]> {
  return page.evaluate(() => window.__dewhollow?.actors() ?? []) as Promise<Actor[]>;
}

async function player(page: Page): Promise<Actor> {
  const found = (await actors(page)).find((a) => a.id === 'player');
  if (!found) throw new Error('找不到玩家');
  return found;
}

async function emotes(page: Page): Promise<Emote[]> {
  return page.evaluate(() => window.__dewhollow?.emotes() ?? []) as Promise<Emote[]>;
}

async function effectLog(page: Page): Promise<LogEntry[]> {
  return page.evaluate(() => window.__dewhollow?.effectLog() ?? []) as Promise<LogEntry[]>;
}

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function press(page: Page, key: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i += 1) await page.keyboard.press(key);
}

/** 等玩家真的靜止：沒有在走、沒有在揮、沒有排隊的動作（姿勢為 0 可能只是一步剛開始的瞬間）。 */
async function settle(page: Page): Promise<void> {
  await expect.poll(async () => (await player(page)).busy).toBe(false);
  expect((await player(page)).pose.y).toBe(0);
}

/** 按下一個鍵，同時每個畫面更新記錄一次玩家的工具狀態。 */
async function pressAndRecordTool(page: Page, key: string, windowMs = 700): Promise<(ToolInfo | null)[]> {
  const recording = page.evaluate(async (ms) => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    const frames: unknown[] = [];
    const start = performance.now();
    while (performance.now() - start < ms) {
      frames.push(debug.actors().find((a) => a.id === 'player')?.tool ?? null);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return frames;
  }, windowMs);
  await page.keyboard.press(key);
  return recording as Promise<(ToolInfo | null)[]>;
}

/** 走到 (x,y)，最後一步朝 `last` 方向移動，讓角色面向那個方向。 */
const toTilledEdge = {
  /** 站在 (3,4)，剛往右走進來，面向右邊的田地 (4,4)。（(2,7) 是出貨箱，所以不能沿著第 2 欄走。） */
  right: async (page: Page) => {
    await press(page, 'ArrowLeft', 4); // (7,9) → (3,9)
    await press(page, 'ArrowUp', 5); // → (3,4)
    await press(page, 'ArrowLeft'); // → (2,4)
    await press(page, 'ArrowRight'); // → (3,4)，面向右
  },
  /** 站在 (10,4)，剛往左走進來，面向左邊的田地 (9,4)。 */
  left: async (page: Page) => {
    await press(page, 'ArrowRight', 4); // (7,9) → (11,9)
    await press(page, 'ArrowUp', 5); // → (11,4)
    await press(page, 'ArrowLeft'); // → (10,4)，面向左
  },
  /** 站在 (7,5)，剛往上走進來，面向上邊的田地 (7,4)。 */
  up: async (page: Page) => {
    await press(page, 'ArrowUp', 4); // (7,9) → (7,5)
  },
};

const rotations = (frames: (ToolInfo | null)[]): number[] => frames.filter((t): t is ToolInfo => t !== null).map((t) => t.rotation);

test.describe('tool swing', () => {
  test('tilling swings the hoe: it is lifted back, comes down hard, and is put away', async ({ page }) => {
    await waitForGame(page);
    await toTilledEdge.right(page);
    await settle(page);

    const frames = await pressAndRecordTool(page, 'x');
    const shown = frames.filter((t): t is ToolInfo => t !== null);
    expect(shown.length).toBeGreaterThan(4);
    expect(new Set(shown.map((t) => t.id))).toEqual(new Set(['hoe']));
    expect(Math.min(...rotations(frames)), '往後舉過肩').toBeLessThan(-1);
    expect(Math.max(...rotations(frames)), '往前砸下').toBeGreaterThan(0.7);
    expect(frames.at(-1), '收起來').toBeNull();
    await expect(page.locator('#hud-log')).toContainText('開墾了一塊田');
  });

  test('facing left is the exact mirror: the hoe is lifted to the other side and swings the other way', async ({ page }) => {
    await waitForGame(page);
    await toTilledEdge.left(page);
    await settle(page);

    const frames = await pressAndRecordTool(page, 'x');
    expect(Math.max(...rotations(frames)), '往左後方舉起').toBeGreaterThan(1);
    expect(Math.min(...rotations(frames)), '往左前方砸下').toBeLessThan(-0.7);
  });

  test('seen from behind the swing is smaller than from the side', async ({ page }) => {
    await waitForGame(page);
    await toTilledEdge.up(page);
    await settle(page);
    const frames = await pressAndRecordTool(page, 'x');
    const spread = Math.max(...rotations(frames)) - Math.min(...rotations(frames));
    expect(spread).toBeGreaterThan(0.8);
    expect(spread).toBeLessThan(1.8); // 側面約 2.3，前後約 60%
  });

  test('each farming action takes out its own tool: hoe, watering can, seed bag', async ({ page }) => {
    await waitForGame(page);
    await toTilledEdge.up(page);
    await settle(page);

    const ids: string[] = [];
    const swing = async (key: string): Promise<void> => {
      const frames = await pressAndRecordTool(page, key);
      const tool = frames.find((t): t is ToolInfo => t !== null);
      if (tool) ids.push(tool.id);
      await settle(page);
    };

    await swing('x'); // 鋤頭：開墾
    await press(page, 'z'); // → 水壺
    await swing('x'); // 澆水
    await press(page, 'z'); // → 種子袋
    await swing('x'); // 播種
    expect(ids).toEqual(['hoe', 'can', 'seedbag']);
    await expect(page.locator('#hud-log')).toContainText('播下了');
  });

  test('pressing the action key the moment you arrive still swings the tool, once the last step is done', async ({ page }) => {
    await waitForGame(page);
    await toTilledEdge.up(page); // 不等靜止：走路動畫還在進行時就按
    const frames = await pressAndRecordTool(page, 'x', 900);
    expect(frames.filter((t) => t !== null).length, '工具有出現').toBeGreaterThan(4);
    await expect.poll(async () => (await effectLog(page)).some((e) => e.name === 'effect:till')).toBe(true);
    const log = await effectLog(page);
    // 揮動是走完那一步之後才開始的，粒子仍然落在命中那一刻之後。
    const start = log.find((e) => e.name === 'swing:till');
    const hit = log.find((e) => e.name === 'effect:till');
    expect((hit?.at ?? 0) - (start?.at ?? 0)).toBeGreaterThan(SWING_MS * (CHOP_IMPACT - 0.2));
  });

  test('the dust, water or seeds appear at the moment of impact, not when the swing starts', async ({ page }) => {
    await waitForGame(page);
    await toTilledEdge.up(page);
    await settle(page);

    await press(page, 'x');
    await expect.poll(async () => (await effectLog(page)).some((e) => e.name === 'effect:till')).toBe(true);
    const log = await effectLog(page);
    const start = log.find((e) => e.name === 'swing:till');
    const hit = log.find((e) => e.name === 'effect:till');
    expect(start && hit).toBeTruthy();
    const delay = (hit?.at ?? 0) - (start?.at ?? 0);
    // 命中在揮動的 55% 處（約 231 毫秒）；留寬容差給慢的機器。
    expect(delay).toBeGreaterThan(SWING_MS * (CHOP_IMPACT - 0.2));
    expect(delay).toBeLessThan(SWING_MS * (CHOP_IMPACT + 0.25));
  });

  test('the soil turns over when the hoe lands, not while it is still in the air', async ({ page }) => {
    await waitForGame(page);
    await toTilledEdge.up(page);
    await settle(page);

    // 每個畫面記錄：畫面上的翻土格數、命中的效果有沒有發生、工具有沒有在揮。
    const recording = page.evaluate(async () => {
      const debug = window.__dewhollow;
      if (!debug) throw new Error('缺少 window.__dewhollow');
      const frames: { soil: number; hit: boolean; swinging: boolean }[] = [];
      const start = performance.now();
      while (performance.now() - start < 900) {
        frames.push({
          soil: debug.sprites().filter((s) => s.key === 'tile.soil').length,
          hit: debug.effectLog().some((e) => e.name === 'effect:till'),
          swinging: debug.actors().find((a) => a.id === 'player')?.tool != null,
        });
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return frames;
    });
    await press(page, 'x');
    const frames = await recording;

    expect(frames.some((f) => f.swinging && !f.hit), '鋤頭還在空中的畫面').toBe(true);
    // 命中之前，田地不能已經變成翻土；命中之後才出現。
    expect(frames.filter((f) => !f.hit).every((f) => f.soil === 0)).toBe(true);
    expect(frames.some((f) => f.hit && f.soil === 1)).toBe(true);
    // 命中的當下就更新，沒有多等。
    const hitFrame = frames.findIndex((f) => f.hit);
    expect(frames[hitFrame]?.soil).toBe(1);
  });

  test('watering darkens the soil only when the water lands, and planting shows the sprout when the seeds land', async ({ page }) => {
    await waitForGame(page);
    await toTilledEdge.up(page);
    await settle(page);
    await press(page, 'x'); // 先翻土
    await settle(page);

    const darkOnImpact = async (key: string, action: string): Promise<void> => {
      await press(page, key); // 切換工具
      const recording = page.evaluate(async (name) => {
        const debug = window.__dewhollow;
        if (!debug) throw new Error('缺少 window.__dewhollow');
        const frames: { hit: boolean; keys: string }[] = [];
        const start = performance.now();
        while (performance.now() - start < 900) {
          frames.push({
            hit: debug.effectLog().some((e) => e.name === `effect:${name}`),
            keys: debug.sprites().map((s) => s.key).filter((k) => k.startsWith('crop.')).join(','),
          });
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        return frames;
      }, action);
      await press(page, 'x');
      const frames = await recording;
      expect(frames.some((f) => f.hit)).toBe(true);
      if (action === 'plant') {
        expect(frames.filter((f) => !f.hit).every((f) => f.keys === '')).toBe(true); // 命中前沒有作物
        expect(frames.some((f) => f.hit && f.keys !== '')).toBe(true);
      }
      await settle(page);
    };
    await darkOnImpact('z', 'water');
    await darkOnImpact('z', 'plant');
  });

  test('the ground shakes a little when the hoe hits', async ({ page }) => {
    await waitForGame(page);
    await toTilledEdge.up(page);
    await settle(page);
    await press(page, 'x');
    await expect.poll(async () => (await effectLog(page)).some((e) => e.name === 'shake')).toBe(true);
  });

  test('swinging does not move the player', async ({ page }) => {
    await waitForGame(page);
    await toTilledEdge.up(page);
    await settle(page);
    const before = await player(page);
    await press(page, 'x');
    await settle(page);
    const after = await player(page);
    expect([after.tileX, after.tileY]).toEqual([before.tileX, before.tileY]);
  });

  test('with reduced motion the swing is calmer and the ground does not shake', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await waitForGame(page);
    await toTilledEdge.right(page);
    await settle(page);

    const frames = await pressAndRecordTool(page, 'x');
    const spread = Math.max(...rotations(frames)) - Math.min(...rotations(frames));
    expect(spread).toBeGreaterThan(0.3); // 工具還是看得到
    expect(spread).toBeLessThan(1.2); // 正常約 2.3，減少動態為 40%
    await expect.poll(async () => (await effectLog(page)).some((e) => e.name === 'effect:till')).toBe(true);
    expect((await effectLog(page)).some((e) => e.name === 'shake')).toBe(false);
  });

  test('a refused action takes out no tool', async ({ page }) => {
    await waitForGame(page);
    // 出生點面向下方的泥土路 (7,10)：不是田，沒有東西可互動。
    const frames = await pressAndRecordTool(page, 'x', 400);
    expect(frames.every((t) => t === null)).toBe(true);
  });
});

test.describe('emotes', () => {
  test('a refused action makes a question mark pop up over the player, which then goes away', async ({ page }) => {
    await waitForGame(page);
    await press(page, 'x'); // 面前是泥土路：沒有東西可互動
    await expect.poll(async () => (await emotes(page)).map((e) => `${e.who}:${e.kind}`)).toEqual(['player:question']);
    await expect.poll(async () => (await emotes(page)).length, { timeout: 4000 }).toBe(0);
  });

  test('the bubble sits above the head, pops up bigger than its final size, then settles', async ({ page }) => {
    await waitForGame(page);
    const recording = page.evaluate(async () => {
      const debug = window.__dewhollow;
      if (!debug) throw new Error('缺少 window.__dewhollow');
      const frames: { emote?: unknown; top?: number }[] = [];
      const start = performance.now();
      while (performance.now() - start < 1200) {
        frames.push({ emote: debug.emotes()[0], top: debug.actors().find((a) => a.id === 'player')?.top });
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return frames;
    });
    await press(page, 'x');
    const frames = (await recording) as { emote?: Emote; top?: number }[];
    const shown = frames.filter((f): f is { emote: Emote; top: number } => f.emote !== undefined && f.top !== undefined);
    expect(shown.length).toBeGreaterThan(5);
    expect(shown.every((f) => f.emote.y < f.top), '氣泡在頭頂上方').toBe(true);
    expect(Math.max(...shown.map((f) => f.emote.scale)), '彈出時比最終大').toBeGreaterThan(1.05);
    expect(shown.some((f) => Math.abs(f.emote.scale - 1) < 0.02), '最後回到正常大小').toBe(true);
  });

  test('with reduced motion the bubble does not overshoot', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await waitForGame(page);
    const recording = page.evaluate(async () => {
      const debug = window.__dewhollow;
      if (!debug) throw new Error('缺少 window.__dewhollow');
      const scales: number[] = [];
      const start = performance.now();
      while (performance.now() - start < 1000) {
        const first = debug.emotes()[0];
        if (first) scales.push(first.scale);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return scales;
    });
    await press(page, 'x');
    const scales = await recording;
    expect(scales.length).toBeGreaterThan(3);
    expect(Math.max(...scales)).toBeLessThanOrEqual(1.001);
  });

  test('a villager shows love for the first gift and a happy note after that', async ({ page }) => {
    await waitForGame(page);
    await press(page, 'ArrowDown', 14);
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('village');
    await press(page, 'ArrowRight', 3);
    await press(page, 'ArrowUp', 4); // (10,6)，面向北邊的毛毛 (10,5)
    await expect.poll(async () => (await player(page)).tileY).toBe(6);
    await settle(page);

    await press(page, 'x');
    await expect.poll(async () => (await emotes(page)).map((e) => `${e.who}:${e.kind}`)).toContain('maomao:heart');
    await expect.poll(async () => (await emotes(page)).length, { timeout: 4000 }).toBe(0);

    await press(page, 'x');
    await expect.poll(async () => (await emotes(page)).map((e) => `${e.who}:${e.kind}`)).toContain('maomao:note');
  });

  test('going to bed shows a sleepy Z', async ({ page }) => {
    await waitForGame(page);
    await press(page, 'ArrowUp', 8); // (7,9) → (7,1)
    await press(page, 'ArrowLeft', 4); // → (3,1)，面向床 (2,1)
    await expect.poll(async () => (await player(page)).tileX).toBe(3);
    await settle(page);
    await press(page, 'x');
    await expect.poll(async () => (await emotes(page)).map((e) => `${e.who}:${e.kind}`)).toContain('player:sleepy');
  });

  test('there is at most one bubble per character at a time', async ({ page }) => {
    await waitForGame(page);
    await press(page, 'x');
    await press(page, 'x');
    await press(page, 'x');
    await expect.poll(async () => (await emotes(page)).length).toBeGreaterThan(0);
    expect((await emotes(page)).filter((e) => e.who === 'player')).toHaveLength(1);
  });
});
