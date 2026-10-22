import { expect, test, type Page } from '@playwright/test';

/**
 * 說明頁（M7）：? 鍵或狀態列的「說明」打開，列出操作按鍵、版本號、更新日誌與隱私說明；Esc 關閉。
 */

/** 等場景真的建立好、鍵盤監聽器掛上才開始按鍵（與 farm-loop.spec.ts 相同的做法）。 */
async function startGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).not.toBe('');
}

test('the ? key opens the help page with controls, version, changelog and privacy', async ({ page }) => {
  await startGame(page);
  await page.keyboard.press('?');
  await expect(page.locator('#help-panel')).toBeVisible();
  await expect(page.locator('#help-version')).toHaveText(/目前版本：v\d+\.\d+\.\d+/);
  await expect(page.locator('#help-body .help-controls li')).not.toHaveCount(0);
  await expect(page.locator('#help-body')).toContainText('更新日誌');
  await expect(page.locator('#help-body')).toContainText('隱私說明');
  await expect(page.locator('#help-body')).toContainText('不收集任何個人資料');
});

test('the changelog lists the version shown in the status bar first', async ({ page }) => {
  await startGame(page);
  const version = ((await page.locator('#hud-version').textContent()) ?? '').trim();
  expect(version).toMatch(/^v\d+\.\d+\.\d+$/);

  await page.keyboard.press('?');
  const changelogHeading = page.locator('#help-body .help-section').nth(1).locator('h4').first();
  await expect(changelogHeading).toContainText(version);
});

test('Esc closes the help page', async ({ page }) => {
  await startGame(page);
  await page.keyboard.press('?');
  await expect(page.locator('#help-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#help-panel')).toBeHidden();
});

test('the help button in the status bar opens and closes the page', async ({ page }) => {
  await startGame(page);
  await page.locator('#hud-help').click();
  await expect(page.locator('#help-panel')).toBeVisible();
  await page.locator('#help-close').click();
  await expect(page.locator('#help-panel')).toBeHidden();
});
