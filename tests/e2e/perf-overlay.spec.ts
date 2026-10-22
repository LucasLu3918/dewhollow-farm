import { expect, test } from '@playwright/test';

/** 量測覆蓋層（見 docs/DEVICE_PERF.md）：只有網址帶 ?perf=1 時才出現，平常不佔用任何資源。 */
test('the frame-time overlay appears only with ?perf=1', async ({ page }) => {
  await page.goto('/?perf=1');
  await expect(page.locator('#game canvas')).toBeVisible();
  const overlay = page.locator('.perf-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('FPS', { timeout: 10_000 });
  await expect(overlay).toHaveAttribute('aria-hidden', 'true');
});

test('shows a full 30-second foreground sample after the window has elapsed', async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto('/?perf=1');
  const overlay = page.locator('.perf-overlay');
  await expect(overlay).toContainText('完整 30 秒視窗：累積中');
  await expect(overlay).toContainText('完整 30 秒視窗 FPS', { timeout: 38_000 });
});

test('a normal visit has no overlay', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('.perf-overlay')).toHaveCount(0);
});
