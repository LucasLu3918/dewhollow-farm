import { expect, test, type Page, type TestInfo } from '@playwright/test';

async function startGame(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function playerPosition(page: Page): Promise<{ x: number; y: number }> {
  const player = await page.evaluate(() => window.__dewhollow?.actors().find((actor) => actor.id === 'player'));
  if (!player) throw new Error('找不到玩家');
  return { x: player.tileX, y: player.tileY };
}

test('holding a movement key crosses consecutive grid steps and release stops input', async ({ page }) => {
  await startGame(page);
  const start = await playerPosition(page);

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(520);
  await page.keyboard.up('ArrowRight');

  await expect.poll(() => page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    return movement?.heldDirection === null && !movement.moving && !movement.pending;
  })).toBe(true);
  const stopped = await playerPosition(page);
  expect(stopped.x - start.x).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(260);
  expect(await playerPosition(page)).toEqual(stopped);
});

test('a deferred action runs once after movement settles and blur cancels it', async ({ page }) => {
  await startGame(page);
  const tool = page.locator('#hud-tool');
  const initialTool = await tool.innerText();

  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().moving ?? false)).toBe(true);
  await page.keyboard.press('z');
  await expect(tool).toHaveText(initialTool);
  await page.keyboard.up('ArrowRight');
  await expect(tool).not.toHaveText(initialTool);
  const cycledTool = await tool.innerText();
  await page.waitForTimeout(200);
  await expect(tool).toHaveText(cycledTool);

  await page.reload();
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  const resetTool = await tool.innerText();
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().moving ?? false)).toBe(true);
  await page.keyboard.press('z');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.keyboard.up('ArrowRight');
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    return movement && !movement.moving && !movement.pending && movement.queuedTaps === 0;
  })).toBe(true);
  await expect(tool).toHaveText(resetTool);
});

test('rapid discrete key presses retain only one buffered step', async ({ page }) => {
  await startGame(page);
  const start = await playerPosition(page);
  const snapshots = [];
  await page.evaluate(() => {
    for (let step = 0; step < 6; step += 1) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', bubbles: true }));
    }
  });
  snapshots.push(await page.evaluate(() => window.__dewhollow?.movement()));
  await test.info().attach('rapid-key-movement-snapshots.json', {
    body: JSON.stringify({ start, snapshots }, null, 2),
    contentType: 'application/json',
  });

  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement()), { timeout: 10_000 }).toMatchObject({
    tile: { x: start.x, y: start.y + 2 },
    heldDirection: null,
    blockedDirection: null,
    moving: false,
    pending: false,
    queuedTaps: 0,
  });
});

test('a short D-pad tap during movement uses the same single-step buffer', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await startGame(page);
  const start = await playerPosition(page);
  const right = page.locator('#touch-controls button[data-action="moveRight"]');

  await right.evaluate((button) => {
    for (const pointerId of [11, 12, 13, 14]) {
      button.dispatchEvent(new PointerEvent('pointerdown', { pointerId, pointerType: 'touch', bubbles: true, cancelable: true }));
      button.dispatchEvent(new PointerEvent('pointerup', { pointerId, pointerType: 'touch', bubbles: true, cancelable: true }));
    }
  });

  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement()), { timeout: 10_000 }).toMatchObject({
    tile: { x: start.x + 2, y: start.y },
    heldDirection: null,
    moving: false,
    pending: false,
    queuedTaps: 0,
  });
  await context.close();
});

test('pixel render profile is selectable for controlled viewport comparison', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startGame(page, '?renderProfile=pixel32');

  const experiment = await page.evaluate(() => window.__dewhollow?.pixelViewport());
  expect(experiment?.profile).toBe('pixel32');
  expect(experiment?.worldTilesVisible.width).toBeGreaterThanOrEqual(8);
  expect(experiment?.worldTilesVisible.width).toBeLessThanOrEqual(10);
  expect(experiment?.actualCanvasResolution).toEqual({ width: experiment?.renderResolution.width, height: experiment?.renderResolution.height });
  await expect(page.locator('#game canvas')).toHaveCSS('object-fit', 'contain');
});

test('legacy production camera meets touch FOV targets after orientation changes', async ({ browser }, testInfo: TestInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await startGame(page);

  const readViewport = () => page.evaluate(() => window.__dewhollow?.pixelViewport());
  await expect.poll(async () => (await readViewport())?.actualWorldTilesVisible.width ?? 0).toBeGreaterThanOrEqual(8);
  let result = await readViewport();
  expect(result?.profile).toBe('legacy');
  expect(result?.actualWorldTilesVisible.width).toBeGreaterThanOrEqual(8);
  expect(result?.actualWorldTilesVisible.width).toBeLessThanOrEqual(10);
  expect(result?.actualWorldTilesVisible.width).toBeCloseTo(result?.worldTilesVisible.width ?? 0, 3);
  const portraitShot = testInfo.outputPath('production-portrait-390x844.png');
  await page.screenshot({ path: portraitShot, fullPage: true, animations: 'disabled' });
  await testInfo.attach('production portrait 390x844', { path: portraitShot, contentType: 'image/png' });

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.responsiveLayout().orientation)).toBe('landscape');
  await expect.poll(async () => Math.round((await readViewport())?.actualWorldTilesVisible.width ?? 0)).toBe(14);
  result = await readViewport();
  expect(result?.profile).toBe('legacy');
  expect(result?.actualWorldTilesVisible.width).toBeGreaterThanOrEqual(12);
  expect(result?.actualWorldTilesVisible.width).toBeLessThanOrEqual(16);
  expect(result?.actualWorldTilesVisible.width).toBeCloseTo(result?.worldTilesVisible.width ?? 0, 3);
  const landscapeShot = testInfo.outputPath('production-landscape-844x390.png');
  await page.screenshot({ path: landscapeShot, fullPage: true, animations: 'disabled' });
  await testInfo.attach('production landscape 844x390', { path: landscapeShot, contentType: 'image/png' });

  await context.close();
});

test('captures same-size gameplay comparisons for legacy, pixel32 and pixel16 profiles', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const profile of ['legacy', 'pixel32', 'pixel16'] as const) {
    await startGame(page, `?renderProfile=${profile}`);
    const actual = await page.evaluate(() => window.__dewhollow?.pixelViewport().actualCanvasResolution);
    const expected = await page.evaluate(() => {
      const debug = window.__dewhollow?.pixelViewport();
      return debug ? { width: debug.renderResolution.width, height: debug.renderResolution.height } : null;
    });
    expect(actual).toEqual(expected);
    const image = await page.screenshot({ animations: 'disabled', fullPage: true });
    await test.info().attach(`${profile}-390x844-gameplay.png`, { body: image, contentType: 'image/png' });
  }
});

test('pixel32 viewport diagnostics stay valid across five viewports and 1x/2x/3x DPR', async ({ browser }) => {
  test.setTimeout(120_000);
  const viewports = [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ];
  const measurements: Array<Record<string, number | string>> = [];

  for (const dpr of [1, 2, 3]) {
    const context = await browser.newContext({ viewport: viewports[0], deviceScaleFactor: dpr });
    const page = await context.newPage();
    await startGame(page, '?renderProfile=pixel32');

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(viewport.width);
      const { result, containerWidth } = await page.evaluate(() => ({
        result: window.__dewhollow?.pixelViewport(),
        containerWidth: window.__dewhollow?.responsiveLayout().worldRect.width ?? 0,
      }));
      expect(result?.profile).toBe('pixel32');
      expect(containerWidth).toBeGreaterThan(0);
      expect(containerWidth).toBeLessThanOrEqual(viewport.width);
      expect(result?.devicePixelScale).toBeGreaterThan(0);
      expect(result?.actualWorldTilesVisible.width).toBeCloseTo(result?.worldTilesVisible.width ?? 0, 3);
      expect(result?.actualWorldTilesVisible.height).toBeCloseTo(result?.worldTilesVisible.height ?? 0, 3);
      expect(result?.actualCanvasResolution).toEqual(result?.renderResolution);
      measurements.push({
        width: viewport.width,
        height: viewport.height,
        containerWidth,
        dpr,
        visibleTiles: result?.actualWorldTilesVisible.width ?? 0,
        cssScale: result?.cssScale ?? 0,
        devicePixelScale: result?.devicePixelScale ?? 0,
        zoom: result?.cameraZoom ?? 0,
      });
    }

    await context.close();
  }

  await test.info().attach('pixel32-viewport-matrix.json', {
    body: JSON.stringify(measurements, null, 2),
    contentType: 'application/json',
  });
});
