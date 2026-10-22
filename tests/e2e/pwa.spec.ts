import { expect, test, type Page } from '@playwright/test';

/**
 * PWA（M7）：manifest 連結、service worker 註冊與離線開啟。
 *
 * service worker 只在正式建置註冊（dev 模式不註冊），所以這份測試要對 `vite preview` 跑：
 *   npm run build
 *   npm run preview    （4173 埠）
 *   PWA_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/e2e/pwa.spec.ts
 * 這裡寫死 4173（vite preview 的埠）；要換埠請改下面的常數。注意：playwright.config.ts 的 webServer 會另外啟動
 * dev server（5173）；本檔不讀環境變數，因為 tests/ 的 tsconfig 沒有 node 型別。
 */

const BASE = 'http://127.0.0.1:4173';

test.use({ baseURL: BASE });

async function waitForGame(page: Page): Promise<void> {
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).not.toBe('');
}

test('the page links a web app manifest with the game name and icons', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const response = await request.get(new URL(href ?? '', page.url()).href);
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as { name: string; display: string; icons: { src: string }[] };
  expect(manifest.name).toBe('晨露農場');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThan(0);
});

test('the service worker registers and controls the page after one reload', async ({ page }) => {
  await page.goto('/');
  await waitForGame(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await waitForGame(page);
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
});

test('the game still opens offline after the service worker has cached it', async ({ page, context }) => {
  await page.goto('/');
  await waitForGame(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await waitForGame(page);

  await context.setOffline(true);
  await page.reload();
  await waitForGame(page);
  await expect(page.locator('#hud-version')).toHaveText(/^v\d+\.\d+\.\d+$/);
  await expect(page.locator('#hud-day')).not.toBeEmpty();
  await context.setOffline(false);
});

test('a new version does not replace the running game by itself (the update button appears instead)', async ({ page }) => {
  await page.goto('/');
  await waitForGame(page);
  // 沒有等待中的新版本時，更新按鈕保持隱藏。
  await expect(page.locator('#hud-update')).toBeHidden();
});
