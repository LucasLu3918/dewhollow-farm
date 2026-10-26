import { expect, test, type Page } from '@playwright/test';

async function start(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
}

test.describe('背包動態格子', () => {
  test('uses the live starting inventory, 24-slot capacity, categories, quality and empty slots', async ({ page }) => {
    await start(page);
    await page.locator('#hud-inventory').click();

    const panel = page.locator('#inventory-panel');
    await expect(panel).toBeVisible();
    await expect(page.locator('#inventory-capacity')).toHaveText('2 / 24');
    await expect(page.locator('#inventory-grid .inventory-slot')).toHaveCount(24);
    await expect(page.locator('#inventory-grid .inventory-slot[data-slot-state="empty"]')).toHaveCount(22);

    const sweetRadishSeed = page.locator('#inventory-grid [data-item-id="seed.sweet-radish"]');
    await expect(sweetRadishSeed).toContainText('甜蘿蔔種子');
    await expect(sweetRadishSeed).toContainText('×5');
    await expect(sweetRadishSeed).toContainText('普通');
    await expect(page.locator('#inventory-grid [data-item-id="seed.moon-bean"]')).toContainText('×2');

    await page.locator('#inventory-filter-farming').click();
    await expect(page.locator('#inventory-filter-farming')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#inventory-grid [data-item-id]')).toHaveCount(2);
    await expect(page.locator('#inventory-grid [data-item-id="seed.sweet-radish"]')).toBeVisible();
  });

  test('retains the actual displayed image when it exists and reports explicit fallback diagnostics otherwise', async ({ page }) => {
    await start(page);
    await page.locator('#hud-inventory').click();

    const icon = page.locator('#inventory-grid [data-item-id="seed.sweet-radish"] .inventory-slot-icon');
    await expect(icon).toHaveAttribute('data-icon-state', /available|fallback/);
    const state = await icon.getAttribute('data-icon-state');
    if (state === 'fallback') await expect(icon).toHaveAttribute('data-diagnostic', 'missing-icon');
    if (state === 'available') await expect(icon.locator('img')).toHaveAttribute('src', /\/assets\/items\//);
  });
});
