import { expect, test, type Page } from '@playwright/test';

async function start(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
}

test.describe('背包物品詳情', () => {
  test('selects a live stack and shows the matching item identity and available details', async ({ page }) => {
    await start(page);
    await page.locator('#hud-inventory').click();

    const detail = page.locator('#inventory-detail');
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAttribute('data-state', 'empty');

    const seed = page.locator('#inventory-grid [data-item-id="seed.sweet-radish"]');
    await seed.click();

    await expect(seed).toHaveAttribute('aria-selected', 'true');
    await expect(detail).toHaveAttribute('data-state', 'selected');
    await expect(detail).toHaveAttribute('data-item-id', 'seed.sweet-radish');
    await expect(detail).toHaveAttribute('data-quality', 'normal');
    await expect(detail).toHaveAttribute('data-count', '5');
    await expect(detail).toContainText('甜蘿蔔種子');
    await expect(detail).toContainText('普通');
    await expect(detail).toContainText('數量：5');
    await expect(detail).toContainText('播種');
    await expect(detail).not.toContainText('售價');
    await expect(detail.locator('.inventory-detail-icon')).toHaveAttribute('data-icon-state', /available|fallback/);
    await expect(seed).toBeFocused();
  });

  test('restores an empty detail state when the selected entry is filtered out', async ({ page }) => {
    await start(page);
    await page.locator('#hud-inventory').click();
    await page.locator('#inventory-grid [data-item-id="seed.sweet-radish"]').click();
    await expect(page.locator('#inventory-detail')).toHaveAttribute('data-state', 'selected');

    await page.locator('#inventory-filter-food').click();

    await expect(page.locator('#inventory-detail')).toHaveAttribute('data-state', 'empty');
    await expect(page.locator('#inventory-detail')).not.toHaveAttribute('data-item-id', /.+/);
    await expect(page.locator('#inventory-detail')).toContainText('選擇一件物品');
  });

  test('keeps the selected detail exact to item id, quality, and stack count', async ({ page }) => {
    await start(page);
    await page.locator('#hud-inventory').click();
    await page.locator('#inventory-grid [data-item-id="seed.moon-bean"]').click();

    const detail = page.locator('#inventory-detail');
    await expect(detail).toHaveAttribute('data-item-id', 'seed.moon-bean');
    await expect(detail).toHaveAttribute('data-quality', 'normal');
    await expect(detail).toHaveAttribute('data-count', '2');
    await expect(detail).toContainText('月光豆種子');
    await expect(page.locator('#inventory-grid [data-item-id="seed.sweet-radish"]')).toHaveAttribute('aria-selected', 'false');
  });

  test.describe('單指觸控', () => {
    test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

    test('tapping a stack selects its matching detail', async ({ page }) => {
      await start(page);
      await page.locator('#hud-inventory').tap();
      const stack = page.locator('#inventory-grid [data-item-id="seed.sweet-radish"]');
      await stack.tap();

      await expect(stack).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#inventory-detail')).toHaveAttribute('data-item-id', 'seed.sweet-radish');
      await expect(page.locator('#inventory-detail')).toHaveAttribute('data-count', '5');
    });
  });
});
