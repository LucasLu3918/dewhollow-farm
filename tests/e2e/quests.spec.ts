import { expect, test, type Page } from '@playwright/test';

/**
 * M5b：委託與佈告欄。J 鍵打開「委託與佈告欄」面板（進行中、今天的佈告欄、居民委託三區），
 * 不花體力與時間，按 Esc 離開。（這個檔案已寫好，但這次沒有執行，依照指示避開 5173 port。）
 * 佈告欄（鎮廣場）與信箱（小屋）的互動路線與取信，目前只由單元測試涵蓋；路線待試玩後再補。
 */
async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

test('J opens the quest panel with its three sections, and Esc closes it without spending time', async ({ page }) => {
  await waitForGame(page);
  const clockBefore = await page.locator('#hud-clock').innerText();

  await page.keyboard.press('j');
  await expect(page.locator('#quest-panel')).toBeVisible();
  for (const label of ['進行中', '佈告欄（今天）', '居民委託']) {
    await expect(page.locator('#quest-list')).toContainText(label);
  }

  await page.keyboard.press('Escape');
  await expect(page.locator('#quest-panel')).toBeHidden();
  await expect(page.locator('#hud-clock')).toHaveText(clockBefore);
});

test('the game boots with the quest and letter content, without a content error', async ({ page }) => {
  await waitForGame(page);
  // 委託與信件的交叉參照已由單元測試檢查；這裡只確認啟動時沒有內容錯誤。
  await expect(page.locator('#hud-log')).not.toContainText('啟動失敗');
});
