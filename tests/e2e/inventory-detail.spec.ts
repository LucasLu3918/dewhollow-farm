import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../../src/domain/game-state';

async function start(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
}

async function replaceSessionState(page: Page, update: (state: GameState) => void): Promise<void> {
  const state = await page.evaluate(() => window.__dewhollow!.gameState());
  update(state);
  await page.evaluate((nextState) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put({ slot: 'slot-1', savedAt: new Date().toISOString(), state: nextState });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  }), state);
  await page.reload();
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

  test('selects a held seed through GameSession and refreshes the HUD', async ({ page }) => {
    await start(page);
    await page.locator('#hud-inventory').click();
    await page.locator('#inventory-grid [data-item-id="seed.moon-bean"]').click();

    const detail = page.locator('#inventory-detail');
    const before = await page.evaluate(() => window.__dewhollow!.gameState());
    await detail.getByRole('button', { name: '設為目前種子' }).click();

    await expect(detail).toHaveAttribute('data-item-id', 'seed.moon-bean');
    await expect(page.locator('#hud-seed')).toContainText('月光豆');
    await expect(page.locator('#hud-tool')).toContainText('種子袋');
    const after = await page.evaluate(() => window.__dewhollow!.gameState());
    expect(after.selectedSeed).toBe('moon-bean');
    expect(after.tool).toBe('seedbag');
    expect(after.inventory).toEqual(before.inventory);
  });

  test('keeps same-item quality stacks separate and shows each true quality-adjusted crop price', async ({ page }) => {
    await start(page);
    await replaceSessionState(page, (state) => {
      state.inventory = {
        capacity: 24,
        stacks: [
          { itemId: 'crop.moon-bean', quality: 'normal', count: 2 },
          { itemId: 'crop.moon-bean', quality: 'good', count: 3 },
        ],
      };
    });

    await page.locator('#hud-inventory').click();
    const stacks = page.locator('#inventory-grid [data-item-id="crop.moon-bean"]');
    await expect(stacks).toHaveCount(2);
    await expect(stacks.nth(0)).toHaveAttribute('data-quality', 'normal');
    await expect(stacks.nth(1)).toHaveAttribute('data-quality', 'good');

    const detail = page.locator('#inventory-detail');
    await stacks.nth(0).click();
    await expect(detail).toHaveAttribute('data-quality', 'normal');
    await expect(detail).toContainText('售價：54 銅幣／個');

    await stacks.nth(1).click();
    await expect(detail).toHaveAttribute('data-quality', 'good');
    await expect(detail).toContainText('售價：68 銅幣／個');
    await expect(detail).toContainText('數量：3');
  });

  test('labels wood as not shippable without showing a zero sale price', async ({ page }) => {
    await start(page);
    await replaceSessionState(page, (state) => {
      state.inventory = { capacity: 24, stacks: [{ itemId: 'wood', quality: 'normal', count: 3 }] };
    });

    await page.locator('#hud-inventory').click();
    await page.locator('#inventory-grid [data-item-id="wood"]').click();
    const detail = page.locator('#inventory-detail');
    await expect(detail).toContainText('不可出貨');
    await expect(detail).not.toContainText('售價：0');
    await expect(detail.locator('.inventory-detail-price')).toHaveCount(0);
  });

  test('shows the real full-bag refusal and preserves the serialized GameSession state', async ({ page }) => {
    await start(page);
    await replaceSessionState(page, (state) => {
      state.inventory = {
        capacity: 2,
        stacks: [
          { itemId: 'sun-hat', quality: 'normal', count: 2 },
          { itemId: 'hay', quality: 'normal', count: 1 },
        ],
      };
      state.wearing = { player: 'clothes' };
    });

    await page.locator('#hud-inventory').click();
    await page.locator('#inventory-grid [data-item-id="sun-hat"]').click();
    const before = await page.evaluate(() => JSON.stringify(window.__dewhollow!.gameState()));
    const detail = page.locator('#inventory-detail');
    await detail.getByRole('button', { name: '穿上' }).click();

    await expect(detail.locator('.inventory-action-feedback')).toHaveAttribute('data-state', 'error');
    await expect(detail.locator('.inventory-action-feedback')).toContainText('背包已滿');
    const after = await page.evaluate(() => JSON.stringify(window.__dewhollow!.gameState()));
    expect(after).toBe(before);
  });

  test('wears one held hat and commits inventory and wearing state together', async ({ page }) => {
    await start(page);
    await replaceSessionState(page, (state) => {
      state.inventory = { capacity: 24, stacks: [{ itemId: 'sun-hat', quality: 'normal', count: 2 }] };
      state.wearing = {};
    });

    await page.locator('#hud-inventory').click();
    await page.locator('#inventory-grid [data-item-id="sun-hat"]').click();
    const detail = page.locator('#inventory-detail');
    const before = await page.evaluate(() => window.__dewhollow!.gameState());
    await detail.getByRole('button', { name: '穿上' }).click();

    await expect(detail.locator('.inventory-action-feedback')).toHaveAttribute('data-state', 'success');
    const after = await page.evaluate(() => window.__dewhollow!.gameState());
    expect(after.wearing.player).toBe('sun-hat');
    expect(after.inventory.stacks).toEqual([{ itemId: 'sun-hat', quality: 'normal', count: 1 }]);
    expect(after.inventory.stacks.reduce((sum, stack) => sum + stack.count, 0)).toBe(
      before.inventory.stacks.reduce((sum, stack) => sum + stack.count, 0) - 1,
    );
  });

  test('takes off the worn item through GameSession and refreshes the inventory detail', async ({ page }) => {
    await start(page);
    await replaceSessionState(page, (state) => {
      state.wearing = { player: 'clothes' };
    });

    await page.locator('#hud-inventory').click();
    await page.locator('#inventory-grid [data-item-id="seed.sweet-radish"]').click();
    const detail = page.locator('#inventory-detail');
    await expect(detail).toHaveAttribute('data-item-id', 'seed.sweet-radish');
    await detail.getByRole('button', { name: '脫下目前穿戴' }).click();

    await expect(detail.locator('.inventory-action-feedback')).toHaveAttribute('data-state', 'success');
    await expect(detail.locator('.inventory-action-feedback')).toContainText('脫下了衣服');
    await expect(page.locator('#inventory-grid [data-item-id="clothes"]')).toBeVisible();
    const state = await page.evaluate(() => window.__dewhollow!.gameState());
    expect(state.wearing.player).toBeUndefined();
    expect(state.inventory.stacks).toContainEqual({ itemId: 'clothes', quality: 'normal', count: 1 });
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
