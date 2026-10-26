import { expect, test, type Page, type TestInfo } from '@playwright/test';

const SETTINGS_KEY = 'dewhollow-farm.settings';
type Movement = {
  tile: { x: number; y: number };
  mapId: string;
  heldDirection: string | null;
  moving: boolean;
  pending: boolean;
  queuedTaps: number;
};

async function start(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 2, settings: { touchControls: 'on' } }));
  }, SETTINGS_KEY);
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#touch-controls')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function movement(page: Page): Promise<Movement> {
  return page.evaluate(() => {
    const debug = window.__dewhollow;
    const current = debug?.movement();
    const player = debug?.actors().find((actor) => actor.id === 'player');
    if (!debug || !current || !player) throw new Error('input cancellation diagnostics are unavailable');
    return {
      tile: { x: player.tileX, y: player.tileY },
      mapId: debug.mapId(),
      heldDirection: current.heldDirection,
      moving: current.moving,
      pending: current.pending,
      queuedTaps: current.queuedTaps,
    };
  });
}

async function waitIdle(page: Page): Promise<Movement> {
  await expect.poll(async () => {
    const state = await movement(page);
    return !state.moving && !state.pending && state.queuedTaps === 0 && state.heldDirection === null;
  }).toBe(true);
  return movement(page);
}

async function pointer(page: Page, action: string, type: 'pointerdown' | 'pointerup' | 'pointercancel', pointerId: number): Promise<void> {
  await page.locator(`#touch-controls button[data-action="${action}"]`).dispatchEvent(type, {
    pointerId,
    pointerType: 'touch',
    button: 0,
    bubbles: true,
    cancelable: true,
  });
}

async function quietSamples(page: Page, durationMs: number): Promise<Movement[]> {
  return page.evaluate((duration) => new Promise<Movement[]>((resolve) => {
    const samples: Movement[] = [];
    const startedAt = performance.now();
    const sample = (): void => {
      const debug = window.__dewhollow;
      const current = debug?.movement();
      const player = debug?.actors().find((actor) => actor.id === 'player');
      if (!debug || !current || !player) throw new Error('input cancellation diagnostics disappeared during quiet window');
      samples.push({
        tile: { x: player.tileX, y: player.tileY },
        mapId: debug.mapId(),
        heldDirection: current.heldDirection,
        moving: current.moving,
        pending: current.pending,
        queuedTaps: current.queuedTaps,
      });
      if (performance.now() - startedAt >= duration) resolve(samples);
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }), durationMs);
}

async function settleAndRecord(page: Page, testInfo: TestInfo, scenario: string, boundary?: Movement): Promise<Movement> {
  const stopped = await waitIdle(page);
  if (boundary) expect(stopped).toMatchObject({ mapId: boundary.mapId, tile: boundary.tile });
  const samples = await quietSamples(page, 300);
  expect(samples.length).toBeGreaterThan(5);
  expect(samples.every((sample) => sample.mapId === stopped.mapId
    && sample.tile.x === stopped.tile.x && sample.tile.y === stopped.tile.y
    && sample.heldDirection === null && !sample.moving && !sample.pending && sample.queuedTaps === 0)).toBe(true);
  const afterQuietWindow = samples.at(-1)!;
  await testInfo.attach(`${scenario}.json`, {
    body: `${JSON.stringify({ scenario, boundary, stopped, quietSamples: samples, afterQuietWindow, quietWindowMs: 300 }, null, 2)}\n`,
    contentType: 'application/json',
  });
  return afterQuietWindow;
}

test.describe('輸入取消與場景轉換', () => {
  test('持續觸控方向穿越農場出口後不會帶入新地圖', async ({ page }, testInfo) => {
    await start(page);
    // Farm south exit is at y=28; position at y=27, then hold down through the transition.
    for (let index = 0; index < 18; index += 1) {
      const before = await movement(page);
      await page.keyboard.press('ArrowDown');
      await expect.poll(async () => (await movement(page)).tile).toEqual({ x: before.tile.x, y: before.tile.y + 1 });
    }
    const before = await movement(page);
    expect(before).toMatchObject({ mapId: 'farm', tile: { y: 27 }, heldDirection: null });

    await pointer(page, 'moveDown', 'pointerdown', 701);
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('village');
    const transition = await movement(page);
    expect(transition.mapId).toBe('village');
    expect(transition).toMatchObject({ heldDirection: null, moving: false, pending: false, queuedTaps: 0 });
    await testInfo.attach('held-direction-map-transition.json', {
      body: `${JSON.stringify({ before, transition }, null, 2)}\n`,
      contentType: 'application/json',
    });
    await settleAndRecord(page, testInfo, 'held-direction-map-transition-stopped', transition);
    await pointer(page, 'moveDown', 'pointerup', 701);
  });

  test('讀取存檔時仍按住方向，重新載入後採用存檔位置且輸入為空', async ({ page }, testInfo) => {
    await start(page);
    await page.keyboard.press('s');
    await expect(page.locator('#hud-log')).toContainText('已存檔');
    const saved = await movement(page);

    await pointer(page, 'moveRight', 'pointerdown', 702);
    await expect.poll(async () => (await movement(page)).heldDirection).toBe('right');
    await expect.poll(async () => (await movement(page)).tile.x).not.toBe(saved.tile.x);
    await page.reload();
    await expect(page.locator('#game canvas')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe(saved.mapId);

    const restored = await waitIdle(page);
    expect(restored.tile).toEqual(saved.tile);
    const samples = await quietSamples(page, 300);
    expect(samples.length).toBeGreaterThan(5);
    expect(samples.every((sample) => sample.mapId === restored.mapId
      && sample.tile.x === restored.tile.x && sample.tile.y === restored.tile.y
      && sample.heldDirection === null && !sample.moving && !sample.pending && sample.queuedTaps === 0)).toBe(true);
    await testInfo.attach('reload-from-save-while-direction-held.json', {
      body: `${JSON.stringify({ saved, restored, quietSamples: samples, afterQuietWindow: samples.at(-1), quietWindowMs: 300 }, null, 2)}\n`,
      contentType: 'application/json',
    });
  });

  test('開啟設定面板會清除仍按住的方向', async ({ page }, testInfo) => {
    await start(page);
    await pointer(page, 'moveRight', 'pointerdown', 703);
    await expect.poll(async () => (await movement(page)).heldDirection).toBe('right');
    await page.locator('#hud-settings').click();
    await expect(page.locator('#settings-panel')).toBeVisible();
    const modalBoundary = await movement(page);
    expect(modalBoundary.mapId).toBe('farm');
    const stopped = await settleAndRecord(page, testInfo, 'modal-open-while-direction-held', modalBoundary);
    await page.locator('#settings-close').click();
  });
});
