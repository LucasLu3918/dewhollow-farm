import { expect, test, type Page } from '@playwright/test';

type Scene = 'house' | 'coop';
const sceneSize = {
  house: { width: 10 * 64, height: 7 * 64 },
  coop: { width: 8 * 64, height: 6 * 64 },
} satisfies Record<Scene, { width: number; height: number }>;

async function setCoarsePointer(page: Page, coarse: boolean): Promise<void> {
  await page.evaluate((nextCoarse) => window.__setPointerCoarse?.(nextCoarse), coarse);
}

async function installPointerSwitch(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const nativeMatchMedia = window.matchMedia.bind(window);
    const coarseQuery = nativeMatchMedia('(pointer: coarse)');
    let currentCoarse = true;
    Object.defineProperty(coarseQuery, 'matches', { configurable: true, get: () => currentCoarse });
    window.matchMedia = (query: string): MediaQueryList =>
      query === '(pointer: coarse)' ? coarseQuery : nativeMatchMedia(query);
    Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { configurable: true, get: () => currentCoarse ? 1 : 0 });
    window.__setPointerCoarse = (value: boolean): void => {
      currentCoarse = value;
      coarseQuery.dispatchEvent(new Event('change'));
    };
  });
}

declare global {
  interface Window {
    __setPointerCoarse?(coarse: boolean): void;
  }
}

async function waitForIdle(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    return movement && !movement.moving && !movement.pending && movement.queuedTaps === 0 && movement.heldDirection === null;
  })).toBe(true);
}

async function waitForScenePaint(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(async () => {
    const source = await window.__dewhollow?.snapshot();
    if (!source) return false;
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) return false;
    context.drawImage(image, 0, 0);
    const pixel = context.getImageData(Math.floor(image.width / 2), Math.floor(image.height / 2), 1, 1).data;
    return (pixel[0] ?? 0) + (pixel[1] ?? 0) + (pixel[2] ?? 0) > 30;
  }), { timeout: 5_000 }).toBe(true);
}

async function walk(page: Page, key: string, steps: number): Promise<void> {
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press(key);
    await waitForIdle(page);
  }
}

async function enterScene(page: Page, scene: Scene): Promise<void> {
  if (scene === 'house') {
    await walk(page, 'ArrowUp', 4);
    await walk(page, 'ArrowLeft', 5);
  } else {
    await walk(page, 'ArrowRight', 27);
    await walk(page, 'ArrowUp', 4);
  }
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe(scene);
}

async function verifySceneAtBothViewports(page: Page, scene: Scene, testInfo: { outputPath: (name: string) => string }): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await installPointerSwitch(page);
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await setCoarsePointer(page, true);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.responsiveLayout().pointer.coarse ?? false)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.cameraView().zoom ?? 0)).toBe(1);
  await enterScene(page, scene);

  const dimensions = sceneSize[scene];
  const mobile = await page.evaluate(() => ({
    camera: window.__dewhollow!.cameraView(),
    state: window.__dewhollow!.gameState(),
    layout: window.__dewhollow!.responsiveLayout(),
  }));
  expect(mobile.layout.pointer.coarse).toBe(true);
  expect(mobile.camera.zoom).toBeLessThanOrEqual(3.25);
  expect(mobile.camera.width).toBeLessThanOrEqual(dimensions.width + 0.1);
  expect(mobile.camera.height).toBeLessThanOrEqual(dimensions.height + 0.1);
  await waitForScenePaint(page);
  await page.screenshot({ path: testInfo.outputPath(`${scene}-mobile.png`), animations: 'disabled' });

  await setCoarsePointer(page, false);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.responsiveLayout().orientation ?? '')).toBe('landscape');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.responsiveLayout().pointer.coarse ?? true)).toBe(false);
  await expect.poll(() => page.evaluate((mapSize) => {
    const camera = window.__dewhollow?.cameraView();
    return camera && camera.width <= mapSize.width + 0.1 && camera.height <= mapSize.height + 0.1;
  }, dimensions)).toBe(true);
  const desktop = await page.evaluate(() => ({
    camera: window.__dewhollow!.cameraView(),
    state: window.__dewhollow!.gameState(),
  }));
  expect(desktop.camera.zoom).toBeLessThanOrEqual(2);
  expect(desktop.state.mapId).toBe(mobile.state.mapId);
  expect(desktop.state.player).toEqual(mobile.state.player);
  expect(await page.evaluate(() => {
    const tile = window.__dewhollow?.movement().tile;
    return tile && { x: tile.x, y: tile.y };
  })).toEqual({ x: mobile.state.player.x, y: mobile.state.player.y });
  await page.screenshot({ path: testInfo.outputPath(`${scene}-desktop.png`), animations: 'disabled' });

  await walk(page, 'ArrowDown', 1);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.cameraView().zoom ?? 0)).toBe(1);
}

test('house framing covers the map on mobile and desktop without changing player state', async ({ page }, testInfo) => {
  await verifySceneAtBothViewports(page, 'house', testInfo);
});

test('coop framing covers the map on mobile and desktop without changing player state', async ({ page }, testInfo) => {
  await verifySceneAtBothViewports(page, 'coop', testInfo);
});
