import { expect, test, type Page, type TestInfo } from '@playwright/test';

const SETTINGS_KEY = 'dewhollow-farm.settings';

interface SavedRecord {
  slot: string;
  savedAt: string;
  state: Record<string, unknown>;
}

async function startTouchGame(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 2, settings: { touchControls: 'on' } }));
  }, SETTINGS_KEY);
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect(page.locator('#touch-controls')).toBeVisible();
}

async function playerTile(page: Page): Promise<{ x: number; y: number }> {
  const player = await page.evaluate(() => window.__dewhollow?.actors().find((actor) => actor.id === 'player'));
  if (!player) throw new Error('找不到玩家');
  return { x: player.tileX, y: player.tileY };
}

async function readSavedRecord(page: Page): Promise<SavedRecord> {
  return page.evaluate(() => new Promise<SavedRecord>((resolve, reject) => {
    const request = indexedDB.open('dewhollow-farm');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('saves').objectStore('saves').get('slot-1');
      get.onsuccess = () => {
        db.close();
        if (!get.result) reject(new Error('找不到 slot-1 存檔'));
        else resolve(get.result as SavedRecord);
      };
      get.onerror = () => { db.close(); reject(get.error); };
    };
  }));
}

async function saveByTouch(page: Page): Promise<SavedRecord> {
  await page.locator('.touch-more-toggle').tap();
  await expect(page.locator('#touch-more')).toBeVisible();
  await page.locator('#touch-more button[data-action="manualSave"]').tap();
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  return readSavedRecord(page);
}

function expectWithinViewport(
  bounds: { x: number; y: number; width: number; height: number } | null,
  viewport: { width: number; height: number },
  label: string,
): void {
  expect(bounds, `${label} 應存在`).not.toBeNull();
  expect(bounds!.x, `${label} 左側`).toBeGreaterThanOrEqual(0);
  expect(bounds!.y, `${label} 上側`).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width, `${label} 右側`).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds!.y + bounds!.height, `${label} 下側`).toBeLessThanOrEqual(viewport.height + 1);
}

test.describe('DF-MOBILE-007 補充驗收', () => {
  test.use({ hasTouch: true });

  test('平板直式 768×1024 的主要操作區保持在 viewport 內並附截圖', async ({ page }, testInfo: TestInfo) => {
    const viewport = { width: 768, height: 1024 };
    await page.setViewportSize(viewport);
    await startTouchGame(page);

    const selectors = [
      '#game', '#game canvas', '.status', '#hud-tool', '#hud-seed', '#hud-action',
      '.touch-move', '.touch-act', '.touch-more-toggle', '#hud-log-toggle',
    ];
    for (const selector of selectors) {
      const target = page.locator(selector);
      await expect(target, `${selector} 可見`).toBeVisible();
      expectWithinViewport(await target.boundingBox(), viewport, selector);
    }

    const screenshotPath = testInfo.outputPath('tablet-768x1024.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach('tablet-768x1024', { path: screenshotPath, contentType: 'image/png' });
  });

  test('觸控可開啟並關閉使用背包種子的選擇面板', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startTouchGame(page);

    const selector = page.locator('#tool-seed-panel');
    await expect(selector).toBeHidden();
    await page.locator('#hud-seed').tap();
    await expect(selector).toBeVisible();
    await expect(page.locator('#tool-seed-list [data-selector-id="sweet-radish"]')).toBeVisible();
    await page.locator('#tool-seed-close').tap();
    await expect(selector).toBeHidden();
  });

  test('直式存檔在切換橫式後仍可再次存檔並重載相同遊戲狀態', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startTouchGame(page);

    const initial = await playerTile(page);
    await page.locator('#touch-controls button[data-action="moveRight"]').tap();
    await expect.poll(() => playerTile(page)).not.toEqual(initial);
    const tileAfterMove = await playerTile(page);
    const savedPortrait = await saveByTouch(page);
    expect(savedPortrait.state).toMatchObject({ mapId: 'farm' });

    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.responsiveLayout().orientation ?? '')).toBe('landscape');
    await expect.poll(() => playerTile(page)).toEqual(tileAfterMove);

    const savedLandscape = await saveByTouch(page);
    const withoutElapsedPlaytime = (state: Record<string, unknown>): Record<string, unknown> => {
      const { playtimeSeconds: _playtimeSeconds, ...persistedState } = state;
      return persistedState;
    };
    expect(withoutElapsedPlaytime(savedLandscape.state)).toEqual(withoutElapsedPlaytime(savedPortrait.state));
    expect(savedLandscape.state.playtimeSeconds).toBeGreaterThanOrEqual(savedPortrait.state.playtimeSeconds as number);
    await page.reload();
    await expect(page.locator('#game canvas')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
    await expect.poll(() => playerTile(page)).toEqual(tileAfterMove);
    await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
    expect(withoutElapsedPlaytime((await readSavedRecord(page)).state)).toEqual(withoutElapsedPlaytime(savedPortrait.state));
  });
});
