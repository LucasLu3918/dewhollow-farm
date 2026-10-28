import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const SETTINGS_KEY = 'dewhollow-farm.settings';

const viewports = [
  { name: 'phone portrait', width: 390, height: 844 },
  { name: 'phone landscape', width: 844, height: 390 },
  { name: 'tablet portrait', width: 768, height: 1024 },
] as const;

type ViewportSnapshot = {
  mapId: string;
  canvas: { x: number; y: number; width: number; height: number };
  zoom: number;
  visibleTiles: { width: number; height: number };
};

async function openTouchGame(browser: Browser, width: number, height: number): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      schemaVersion: 2,
      settings: {
        touchControls: 'on',
        mobile: { controlStyle: 'dpad', handedness: 'right', controlsPlacement: 'overlay' },
      },
    }));
  }, SETTINGS_KEY);
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');

  await expect(page.locator('#touch-controls')).toBeVisible();
  return { context, page };
}

async function stableSnapshot(page: Page): Promise<ViewportSnapshot> {
  let previous: ViewportSnapshot | undefined;
  let matches = 0;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5_000) {
    const current = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
      const debug = window.__dewhollow;
      if (!canvas || !debug) throw new Error('遊戲 viewport diagnostics 尚未就緒');
      const rect = canvas.getBoundingClientRect();
      return {
        mapId: debug.mapId(),
        canvas: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        zoom: debug.cameraView().zoom,
        visibleTiles: debug.pixelViewport().actualWorldTilesVisible,
      };
    });
    if (previous && JSON.stringify(current) === JSON.stringify(previous)) matches += 1;
    else matches = 0;
    if (matches >= 2) return current;
    previous = current;
    await page.waitForTimeout(50);
  }
  throw new Error('viewport 未能在 5 秒內收斂到連續三次相同快照');
}

function expectSameViewport(actual: ViewportSnapshot, expected: ViewportSnapshot): void {
  expect(actual.mapId).toBe(expected.mapId);
  expect(actual.zoom).toBeCloseTo(expected.zoom, 6);
  for (const dimension of ['x', 'y', 'width', 'height'] as const) {
    expect(actual.canvas[dimension], `canvas ${dimension}`).toBeCloseTo(expected.canvas[dimension], 0);
  }
  expect(actual.visibleTiles.width).toBeCloseTo(expected.visibleTiles.width, 6);
  expect(actual.visibleTiles.height).toBeCloseTo(expected.visibleTiles.height, 6);
}

async function playerTile(page: Page): Promise<{ x: number; y: number }> {
  const player = await page.evaluate(() => window.__dewhollow?.actors().find((actor) => actor.id === 'player'));
  if (!player) throw new Error('找不到玩家');
  return { x: player.tileX, y: player.tileY };
}

async function expectControlsWithinViewport(page: Page, width: number, height: number): Promise<void> {
  const controls = page.locator('#touch-controls button:visible');
  await expect(controls.first()).toBeVisible();
  const boxes = await controls.evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    return { x: rect.left, y: rect.top, right: rect.right, bottom: rect.bottom };
  }));
  expect(boxes.length).toBeGreaterThan(0);
  for (const [index, box] of boxes.entries()) {
    expect(box.x, `control ${index} left`).toBeGreaterThanOrEqual(0);
    expect(box.y, `control ${index} top`).toBeGreaterThanOrEqual(0);
    expect(box.right, `control ${index} right`).toBeLessThanOrEqual(width + 1);
    expect(box.bottom, `control ${index} bottom`).toBeLessThanOrEqual(height + 1);
  }
}

async function checkPanel(page: Page, trigger: string, panel: string, close: string, baseline: ViewportSnapshot): Promise<void> {
  await page.locator(trigger).tap();
  await expect(page.locator(panel)).toBeVisible();
  expectSameViewport(await stableSnapshot(page), baseline);
  await page.locator(close).tap();
  await expect(page.locator(panel)).toBeHidden();
  expectSameViewport(await stableSnapshot(page), baseline);
}

test('mobile panels and touch controls preserve the world viewport across orientation changes', async ({ browser }) => {
  test.setTimeout(120_000);
  for (const viewport of viewports) {
    const { context, page } = await openTouchGame(browser, viewport.width, viewport.height);
    try {
      await expectControlsWithinViewport(page, viewport.width, viewport.height);

      const start = await playerTile(page);
      await page.locator('#touch-controls button[data-action="moveUp"]').tap();
      await expect.poll(() => playerTile(page)).not.toEqual(start);
      await expect.poll(() => page.evaluate(() => {
        const movement = window.__dewhollow?.movement();
        return !movement || (!movement.moving && !movement.pending && movement.queuedTaps === 0);
      })).toBe(true);

      const baseline = await stableSnapshot(page);
      await checkPanel(page, '#hud-help', '#help-panel', '#help-close', baseline);
      await checkPanel(page, '#hud-saves', '#save-panel', '#save-close', baseline);
      await checkPanel(page, '#hud-settings', '#settings-panel', '#settings-close', baseline);
      await checkPanel(page, '#hud-inventory', '#inventory-panel', '#inventory-close', baseline);

      const rotated = viewport.width > viewport.height
        ? { width: 390, height: 844 }
        : { width: 844, height: 390 };
      await page.setViewportSize(rotated);
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.responsiveLayout().orientation ?? ''))
        .toBe(rotated.width > rotated.height ? 'landscape' : 'portrait');
      const afterRotation = await stableSnapshot(page);
      expect(afterRotation.mapId).toBe(baseline.mapId);
      expect(afterRotation.zoom).toBeGreaterThan(0);
      expect(afterRotation.visibleTiles.width).toBeGreaterThan(0);
      await expectControlsWithinViewport(page, rotated.width, rotated.height);
      await checkPanel(page, '#hud-help', '#help-panel', '#help-close', afterRotation);
    } finally {
      await context.close();
    }
  }
});
