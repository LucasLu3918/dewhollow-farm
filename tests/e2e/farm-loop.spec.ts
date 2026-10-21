import { expect, test, type Page } from '@playwright/test';

/**
 * 驗收路徑（MVP_SPEC）：開墾 → 播種 → 澆水 → 存檔 → 重新整理後接續 → 睡覺進入第 2 天。
 * 收成與出貨的規則由單元測試覆蓋，這裡只確認完整流程在瀏覽器中能跑通且存檔可還原。
 *
 * 地圖座標（晨露農場）：出生點 (7,9)；田地 x=4..9、y=3..5；床位 (2,1)。
 * 面向移動方向的前方格子會被互動。
 */
async function press(page: Page, keys: string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

/**
 * 等場景真的建立好、鍵盤監聽器掛上才開始按鍵。不能只看 HUD 文字：index.html 一開始就寫著「第 1 天」，
 * 讀檔訊息也是在 Phaser 場景建立之前就寫進 HUD，太早按鍵會被丟掉。
 * 開發模式的 window.__dewhollow 在場景的 create() 裡與鍵盤監聽器同一個同步段落建立，所以它出現就代表可以按鍵了。
 */
async function waitForScene(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).not.toBe('');
}

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#hud-day')).toHaveText('第 1 天');
  await waitForScene(page);
}

// 每個測試使用獨立的瀏覽器情境（context），因此 IndexedDB 是乾淨的。
test('plays the vertical slice and resumes from a save', async ({ page }) => {
  await waitForGame(page);

  // 向上走到 (7,5)，面向 (7,4) 的田地後開墾。
  await press(page, ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp']);
  await press(page, ['x']);
  await expect(page.locator('#hud-energy-text')).toHaveText('98 / 100');
  await expect(page.locator('#hud-log')).toContainText('開墾了一塊田');

  // 切到種子袋並播種（預設為第一個持有的種子：月光豆）。
  await press(page, ['z', 'z', 'x']);
  await expect(page.locator('#hud-log')).toContainText('播下了 月光豆 種子');
  await expect(page.locator('#hud-energy-text')).toHaveText('97 / 100');

  // 切到水壺並澆水。
  await press(page, ['z', 'z', 'x']);
  await expect(page.locator('#hud-log')).toContainText('澆了水');
  await expect(page.locator('#hud-energy-text')).toHaveText('96 / 100');

  // 手動存檔後重新整理，應讀回體力與存檔提示。
  await press(page, ['s']);
  await expect(page.locator('#hud-log')).toContainText('已存檔');

  await page.reload();
  await waitForScene(page);
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await expect(page.locator('#hud-energy-text')).toHaveText('96 / 100');
  await expect(page.locator('#hud-day')).toHaveText('第 1 天');

  // 走到床邊 (3,1) 面向床位後睡覺，進入第 2 天並恢復體力。
  await press(page, ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp']);
  await press(page, ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft']);
  await press(page, ['x']);
  await expect(page.locator('#hud-day')).toHaveText('第 2 天');
  await expect(page.locator('#hud-energy-text')).toHaveText('100 / 100');
  await expect(page.locator('#hud-log')).toContainText('你睡了一覺');

  // 第 2 天重新整理，存檔應保留第 2 天。
  await page.reload();
  await waitForScene(page);
  await expect(page.locator('#hud-day')).toHaveText('第 2 天');
  await expect(page.locator('#hud-gold')).toHaveText('100 金');
});
