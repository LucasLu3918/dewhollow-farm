import { expect, test, type Page } from '@playwright/test';

/**
 * M5a：居民與好感。F 鍵打開「居民與好感」面板，列出六位居民（顆心、今天是否已聊過、送過禮、喜歡的東西）。
 * 面板不花體力與時間，按 Esc 離開。（這個檔案已寫好，但這次沒有執行，依照指示避開 5173 port。）
 */
async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

test('F opens the residents panel with all six residents, and Esc closes it without spending time', async ({ page }) => {
  await waitForGame(page);
  const clockBefore = await page.locator('#hud-clock').innerText();

  await page.keyboard.press('f');
  await expect(page.locator('#resident-panel')).toBeVisible();
  for (const name of ['毛毛', '榕伯', '阿柑', '石師傅', '芷蘭', '小穗']) {
    await expect(page.locator('#resident-list')).toContainText(name);
  }
  await expect(page.locator('#resident-list')).toContainText('今天還沒聊');

  await page.keyboard.press('Escape');
  await expect(page.locator('#resident-panel')).toBeHidden();
  await expect(page.locator('#hud-clock')).toHaveText(clockBefore);
});

test('the game boots with the plaza and the schedules in the content, without a content error', async ({ page }) => {
  await waitForGame(page);
  // 內容的交叉參照（行程、心形事件、通往廣場的門）已由單元測試檢查；這裡只確認啟動時沒有內容錯誤。
  await expect(page.locator('#hud-log')).not.toContainText('啟動失敗');
});
