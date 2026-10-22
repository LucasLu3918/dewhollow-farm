import { expect, test, type Page } from '@playwright/test';

/**
 * 觸控操作（M7）：虛擬按鍵（pointer events）模擬對應按鍵的 handleKey，直式與橫式都不蓋住遊戲區，
 * 觸控與鍵盤並存，設定可以強制顯示或隱藏。
 * 本檔尚未執行（依任務規定，不跑 npm run test:e2e）。
 */

const SETTINGS_KEY = 'dewhollow-farm.settings';

/** 先寫好偏好再載入頁面（偏好在頁面載入時讀取）。 */
async function seedTouchMode(page: Page, touchControls: 'auto' | 'on' | 'off'): Promise<void> {
  await page.addInitScript(
    ({ key, mode }) => {
      window.localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, touchControls: mode }));
    },
    { key: SETTINGS_KEY, mode: touchControls },
  );
}

async function startGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).not.toBe('');
}

/** 點一下虛擬按鍵（用 pointer events 觸發，與觸控裝置送出的事件相同）。 */
async function tapPad(page: Page, action: string): Promise<void> {
  const button = page.locator(`#touch-controls button[data-action="${action}"]`);
  await button.dispatchEvent('pointerdown');
  await button.dispatchEvent('pointerup');
}

test.describe('直式手機（390 x 844，觸控）', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('虛擬按鍵顯示在遊戲區的下方，不蓋住畫面', async ({ page }) => {
    await seedTouchMode(page, 'on');
    await startGame(page);
    const pad = page.locator('#touch-controls');
    await expect(pad).toBeVisible();
    const stage = await page.locator('#game').boundingBox();
    const padBox = await pad.boundingBox();
    expect(stage).not.toBeNull();
    expect(padBox).not.toBeNull();
    expect((padBox?.y ?? 0) >= (stage?.y ?? 0) + (stage?.height ?? 0)).toBe(true);
  });

  test('點技能鍵（虛擬）會打開技能面板，與鍵盤 K 相同', async ({ page }) => {
    await seedTouchMode(page, 'on');
    await startGame(page);
    await tapPad(page, 'skills');
    await expect(page.locator('#skill-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#skill-panel')).toBeHidden();
  });

  test('點居民鍵（虛擬）會打開居民面板，點了之後仍可用鍵盤', async ({ page }) => {
    await seedTouchMode(page, 'on');
    await startGame(page);
    await tapPad(page, 'residents');
    await expect(page.locator('#resident-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('k');
    await expect(page.locator('#skill-panel')).toBeVisible();
  });
});

test.describe('橫式手機（844 x 390，觸控）', () => {
  test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });

  test('橫式時方向鍵在遊戲區左側、動作鍵在右側，兩組都不與遊戲區重疊', async ({ page }) => {
    await seedTouchMode(page, 'on');
    await startGame(page);
    const stage = await page.locator('#game').boundingBox();
    expect(stage).not.toBeNull();
    for (const group of ['.touch-move', '.touch-act']) {
      const box = await page.locator(group).boundingBox();
      expect(box, group).not.toBeNull();
      const apart =
        (box?.x ?? 0) + (box?.width ?? 0) <= (stage?.x ?? 0) || (box?.x ?? 0) >= (stage?.x ?? 0) + (stage?.width ?? 0);
      expect(apart, group).toBe(true);
    }
    const move = await page.locator('.touch-move').boundingBox();
    const act = await page.locator('.touch-act').boundingBox();
    expect((move?.x ?? 0) < (stage?.x ?? 0)).toBe(true);
    expect((act?.x ?? 0) > (stage?.x ?? 0)).toBe(true);
  });
});

test.describe('虛擬按鍵的顯示設定', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('設定為隱藏時，即使是觸控裝置也不顯示', async ({ page }) => {
    await seedTouchMode(page, 'off');
    await startGame(page);
    await expect(page.locator('#touch-controls')).toBeHidden();
  });

  test('預設為自動：只有觸控裝置（pointer: coarse）才顯示', async ({ page }) => {
    await startGame(page);
    const coarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
    if (coarse) await expect(page.locator('#touch-controls')).toBeVisible();
    else await expect(page.locator('#touch-controls')).toBeHidden();
  });
});
