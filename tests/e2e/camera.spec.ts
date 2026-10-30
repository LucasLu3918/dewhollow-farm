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

test('camera follows the player on the large farm and stays inside the map', async ({ page }) => {
  test.setTimeout(90_000);
  await waitForGame(page);

  const initial = await cameraView(page);
  expect(initial).toBeDefined();
  const initialScroll = await scroll(page);
  expect(initialScroll.x).toBeGreaterThanOrEqual(initial!.bounds.x);
  expect(initialScroll.x).toBeLessThanOrEqual(initial!.bounds.x + initial!.bounds.width - initial!.width);
  expect(initialScroll.y).toBeGreaterThanOrEqual(initial!.bounds.y);
  expect(initialScroll.y).toBeLessThanOrEqual(initial!.bounds.y + initial!.bounds.height - initial!.height);

  // 繞過南側出貨箱，再走到最底（y=28），鏡頭應停在下邊界。
  await press(page, 'ArrowDown', 12);
  await press(page, 'ArrowLeft', 1);
  await press(page, 'ArrowDown', 2);
  await expect.poll(async () => (await scroll(page)).y).toBeCloseTo((await cameraView(page))!.bounds.y + (await cameraView(page))!.bounds.height - (await cameraView(page))!.height, 0);

  // 沿中央南北路回到 y=14，再走東側橫路到 x=38，驗證最右側鏡頭邊界。
  await press(page, 'ArrowUp', 14);
  await press(page, 'ArrowRight', 19);
  await expect.poll(async () => {
    const player = await page.evaluate(() => window.__dewhollow?.actors().find((actor) => actor.id === 'player'));
    return player ? [player.tileX, player.tileY] : null;
  }).toEqual([38, 14]);
  await expect.poll(async () => {
    const position = await scroll(page);
    const camera = await cameraView(page);
    return Math.abs(position.x - (camera!.bounds.x + camera!.bounds.width - camera!.width));
  }).toBeLessThanOrEqual(1);
});

test('camera is reframed when changing maps', async ({ page }) => {
  await waitForGame(page);

  // 村莊相對於目前 camera viewport 不足時會置中，viewport 大於地圖時不會露出邊界外。
  await press(page, 'ArrowDown', 12);
  await press(page, 'ArrowLeft', 1);
  await press(page, 'ArrowDown', 2);
  await press(page, 'ArrowRight', 1);
  await press(page, 'ArrowDown', 1);
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

test('the independent greenhouse room has bounded camera framing, blocking walls, and a natural return door', async ({ page }) => {
  await waitForGame(page);
  const state = await page.evaluate(() => window.__dewhollow?.gameState());
  if (!state) throw new Error('缺少目前遊戲狀態');
  await page.evaluate((nextState) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put({ slot: 'slot-1', savedAt: new Date().toISOString(), state: {
        ...nextState, schemaVersion: 26, mapId: 'greenhouse', player: { x: 6, y: 6, facing: 'down' },
        flags: { ...nextState.flags, greenhouse: true },
      } });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
    };
  }), state);
  await page.reload();
  await expect.poll(() => mapId(page)).toBe('greenhouse');
  const greenhouseCamera = await cameraView(page);
  const room = { width: 12 * 64, height: 9 * 64 };
  const expectedBounds = {
    x: room.width >= greenhouseCamera!.width ? 0 : -(greenhouseCamera!.width - room.width) / 2,
    y: room.height >= greenhouseCamera!.height ? 0 : -(greenhouseCamera!.height - room.height) / 2,
    width: Math.max(room.width, greenhouseCamera!.width),
    height: Math.max(room.height, greenhouseCamera!.height),
  };
  expect(greenhouseCamera!.bounds.x).toBeCloseTo(expectedBounds.x, 2);
  expect(greenhouseCamera!.bounds.y).toBeCloseTo(expectedBounds.y, 2);
  expect(greenhouseCamera!.bounds.width).toBeCloseTo(expectedBounds.width, 2);
  expect(greenhouseCamera!.bounds.height).toBeCloseTo(expectedBounds.height, 2);
  expect(greenhouseCamera!.bounds.height).toBe(greenhouseCamera!.height);

  await walk(page, 'ArrowLeft', 5);
  const atWestWall = await page.evaluate(() => window.__dewhollow?.movement().tile);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().tile)).toEqual(atWestWall);

  await walk(page, 'ArrowRight', 5);
  await walk(page, 'ArrowDown', 2);
  await expect.poll(() => mapId(page)).toBe('farm');
  await waitForPlayer(page, 7, 9);
});
