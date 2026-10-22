import { expect, test, type Page } from '@playwright/test';

async function start(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).not.toBe('');
}

test.describe('MB-07 compact HUD and shared panel shell', () => {
  test('primary action follows the facing target and dispatches through the existing interaction route', async ({ page }) => {
    await start(page);
    const action = page.locator('#hud-action');
    await expect(action).toBeVisible();
    await expect(action).toHaveText(/.+/);
    await expect(action).toHaveAttribute('aria-label', /主要動作：/);
    await expect(action).toBeDisabled();
    await expect(action).toHaveText('沒有可互動的目標');
    for (let step = 0; step < 4; step += 1) await page.keyboard.press('ArrowUp');
    await expect(action).toBeEnabled();
    await expect(action).toHaveText('開墾');
    await action.click();
    await expect(page.locator('#hud-log')).toContainText('開墾了一塊田');
  });

  test('focus remains trapped and returns to the opener; settings scroll and focus survive rotation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 600 });
    await start(page);
    const opener = page.locator('#hud-settings');
    const panel = page.locator('#settings-panel');
    await opener.click();
    await expect(panel).toBeVisible();
    await page.locator('#settings-close').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#settings-keys button').first()).toBeFocused();

    const remembered = page.locator('#settings-placement');
    await remembered.focus();
    await panel.evaluate((element) => { element.scrollTop = Math.min(160, element.scrollHeight); });
    const scrollBefore = await panel.evaluate((element) => element.scrollTop);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByLabel('按鍵版位')).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.responsiveLayout().orientation ?? '')).toBe('landscape');
    expect(await panel.evaluate((element) => element.scrollTop)).toBe(scrollBefore);

    await page.locator('#settings-close').click();
    await expect(panel).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('100/125/150% text fits the mobile sheet and its close control stays reachable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 600 });
    await start(page);
    await page.locator('#hud-settings').click();
    const panel = page.locator('#settings-panel');
    const close = page.locator('#settings-close');
    for (const [font, scale] of [['standard', '1'], ['large', '1.25'], ['xlarge', '1.5']] as const) {
      await page.locator(`#settings-font button[data-font="${font}"]`).click();
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-scale'))).toBe(scale);
      const bounds = await panel.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const button = element.querySelector('#settings-close')!.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, height: rect.height, scrollHeight: element.scrollHeight,
          closeTop: button.top, closeBottom: button.bottom, viewport: innerHeight };
      });
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewport + 1);
      expect(bounds.closeTop).toBeGreaterThanOrEqual(bounds.top);
      expect(bounds.closeBottom).toBeLessThanOrEqual(bounds.bottom + 1);
      expect(bounds.height).toBeLessThanOrEqual(528);
      expect(bounds.scrollHeight).toBeGreaterThan(bounds.height);
      await expect(close).toBeVisible();
    }
  });
});
