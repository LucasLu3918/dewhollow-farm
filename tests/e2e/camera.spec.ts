import { expect, test, type Page } from '@playwright/test';

/**
 * 鏡頭捲動：大地圖必須跟著主角且不越界；小地圖也要留在可視範圍內，不露出地圖邊界。
 * 鏡頭位置由開發模式的 window.__dewhollow 提供（正式建置不含）。
 */
async function press(page: Page, key: string, times: number): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await page.keyboard.press(key);
    if (key.startsWith('Arrow')) await waitForMovementIdle(page);
  }
}

async function waitForMovementIdle(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    return !movement || (!movement.moving && !movement.pending && movement.queuedTaps === 0 && movement.heldDirection === null);
  })).toBe(true);
}

async function scroll(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow（需用開發伺服器執行）');
    return debug.cameraScroll();
  });
}

async function cameraView(page: Page) {
  return page.evaluate(() => window.__dewhollow?.cameraView());
}

async function mapId(page: Page): Promise<string> {
  return page.evaluate(() => window.__dewhollow?.mapId() ?? '');
}

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 1 天');
  await expect.poll(() => mapId(page)).toBe('farm');
}

async function walk(page: Page, key: string, times: number): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await page.keyboard.press(key);
    await waitForMovementIdle(page);
  }
}

async function waitForPlayer(page: Page, x: number, y: number): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const player = window.__dewhollow?.actors().find((actor) => actor.id === 'player');
    return player && !player.busy ? [player.tileX, player.tileY] : null;
  })).toEqual([x, y]);
}

async function greenhouseFencePixel(page: Page, x: number, y: number): Promise<[number, number, number]> {
  return page.evaluate(async ({ tileX, tileY }) => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    const camera = debug.cameraView();
    const scroll = debug.cameraScroll();
    const image = new Image();
    image.src = await debug.snapshot();
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('沒有 2D canvas context');
    context.drawImage(image, 0, 0);
    // Fence art leaves a clear gap above its rails at the center of each tile.
    const px = Math.round(camera.x + (tileX * 64 + 32 - scroll.x) * camera.zoom);
    const py = Math.round(camera.y + (tileY * 64 + 8 - scroll.y) * camera.zoom);
    const pixel = context.getImageData(px, py, 1, 1).data;
    return [pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0];
  }, { tileX: x, tileY: y });
}

test('camera follows the player on the large farm and stays inside the map', async ({ page }) => {
  await waitForGame(page);

  const initial = await cameraView(page);
  expect(initial).toBeDefined();
  const initialScroll = await scroll(page);
  expect(initialScroll.x).toBeGreaterThanOrEqual(initial!.bounds.x);
  expect(initialScroll.x).toBeLessThanOrEqual(initial!.bounds.x + initial!.bounds.width - initial!.width);
  expect(initialScroll.y).toBeGreaterThanOrEqual(initial!.bounds.y);
  expect(initialScroll.y).toBeLessThanOrEqual(initial!.bounds.y + initial!.bounds.height - initial!.height);

  // 往南走到最底（y=28），鏡頭應停在下邊界，不會露出地圖外。
  await press(page, 'ArrowDown', 19);
  await expect.poll(async () => (await scroll(page)).y).toBeCloseTo((await cameraView(page))!.bounds.y + (await cameraView(page))!.bounds.height - (await cameraView(page))!.height, 0);

  // 再往東走到 x=38，鏡頭應停在右邊界。
  await press(page, 'ArrowRight', 31);
  await expect.poll(async () => {
    const player = await page.evaluate(() => window.__dewhollow?.actors().find((actor) => actor.id === 'player'));
    return player ? [player.tileX, player.tileY] : null;
  }).toEqual([38, 28]);
  await expect.poll(async () => (await scroll(page)).x).toBeCloseTo((await cameraView(page))!.bounds.x + (await cameraView(page))!.bounds.width - (await cameraView(page))!.width, 0);
});

test('camera is reframed when changing maps', async ({ page }) => {
  await waitForGame(page);

  // 村莊相對於目前 camera viewport 不足時會置中，viewport 大於地圖時不會露出邊界外。
  await press(page, 'ArrowDown', 20);
  await expect.poll(() => mapId(page)).toBe('village');
  const villageCamera = await cameraView(page);
  const villageWorld = { width: 16 * 64, height: 12 * 64 };
  const expectedVillageBounds = {
    x: villageWorld.width >= villageCamera!.width ? 0 : -(villageCamera!.width - villageWorld.width) / 2,
    y: villageWorld.height >= villageCamera!.height ? 0 : -(villageCamera!.height - villageWorld.height) / 2,
    width: Math.max(villageWorld.width, villageCamera!.width),
    height: Math.max(villageWorld.height, villageCamera!.height),
  };
  expect(villageCamera!.bounds.x).toBeCloseTo(expectedVillageBounds.x, 2);
  expect(villageCamera!.bounds.y).toBeCloseTo(expectedVillageBounds.y, 2);
  expect(villageCamera!.bounds.width).toBeCloseTo(expectedVillageBounds.width, 2);
  expect(villageCamera!.bounds.height).toBeCloseTo(expectedVillageBounds.height, 2);
  await expect.poll(async () => {
    const position = await scroll(page);
    const camera = await cameraView(page);
    return position.x >= camera!.bounds.x && position.x <= camera!.bounds.x + camera!.bounds.width - camera!.width &&
      position.y >= camera!.bounds.y && position.y <= camera!.bounds.y + camera!.bounds.height - camera!.height;
  }).toBe(true);

  // 從村莊的門回到農場：直接出現在農場南端，鏡頭貼著下邊界而不是從舊位置慢慢滑過來。
  await press(page, 'ArrowDown', 1);
  await expect.poll(() => mapId(page)).toBe('farm');
  await expect.poll(async () => (await scroll(page)).y).toBeCloseTo((await cameraView(page))!.bounds.y + (await cameraView(page))!.bounds.height - (await cameraView(page))!.height, 0);
});

test('greenhouse transparent fence gaps show grass on both mirrored sides', async ({ page }) => {
  await waitForGame(page);

  // Approach the west side from the north and sample the transparent center gap in fence tile (27,22).
  await walk(page, 'ArrowDown', 11);
  await walk(page, 'ArrowRight', 19);
  await walk(page, 'ArrowDown', 2);
  await waitForPlayer(page, 26, 22);
  await page.waitForTimeout(150);
  const west = await greenhouseFencePixel(page, 27, 22);

  // Walk around the greenhouse to reach the mirrored east fence at (33,22).
  await walk(page, 'ArrowDown', 4);
  await walk(page, 'ArrowRight', 8);
  await walk(page, 'ArrowUp', 4);
  await waitForPlayer(page, 34, 22);
  await page.waitForTimeout(150);
  const east = await greenhouseFencePixel(page, 33, 22);

  for (const [side, [red, green, blue]] of [['west', west], ['east', east]] as const) {
    expect(green, `${side} fence gap should reveal grass`).toBeGreaterThan(red * 1.2);
    expect(green, `${side} fence gap should reveal grass`).toBeGreaterThan(blue * 1.1);
  }
});
