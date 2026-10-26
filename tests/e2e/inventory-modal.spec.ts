import { expect, test, type Page } from '@playwright/test';

const SETTINGS_KEY = 'dewhollow-farm.settings';

type Movement = {
  tile: { x: number; y: number };
  heldDirection: string | null;
  moving: boolean;
  pending: boolean;
  queuedTaps: number;
};

async function start(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 2, settings: { touchControls: 'on' } }));
  }, SETTINGS_KEY);
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#touch-controls')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function movement(page: Page): Promise<Movement> {
  return page.evaluate(() => {
    const debug = window.__dewhollow;
    const current = debug?.movement();
    const player = debug?.actors().find((actor) => actor.id === 'player');
    if (!debug || !current || !player) throw new Error('input cancellation diagnostics are unavailable');
    return {
      tile: { x: player.tileX, y: player.tileY },
      heldDirection: current.heldDirection,
      moving: current.moving,
      pending: current.pending,
      queuedTaps: current.queuedTaps,
    };
  });
}

test.describe('背包 modal ownership', () => {
  test('open inventory blocks keyboard and touch movement input', async ({ page }) => {
    await start(page);
    const before = await movement(page);
    await page.locator('#hud-inventory').click();
    await expect(page.locator('#inventory-panel')).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await page.locator('#touch-controls button[data-action="moveRight"]').dispatchEvent('pointerdown', {
      pointerId: 811,
      pointerType: 'touch',
      button: 0,
      bubbles: true,
      cancelable: true,
    });

    await expect.poll(async () => {
      const state = await movement(page);
      return state.tile.x === before.tile.x
        && state.tile.y === before.tile.y
        && state.heldDirection === null
        && !state.moving
        && !state.pending
        && state.queuedTaps === 0;
    }).toBe(true);
    await page.locator('#touch-controls button[data-action="moveRight"]').dispatchEvent('pointerup', {
      pointerId: 811,
      pointerType: 'touch',
      button: 0,
      bubbles: true,
      cancelable: true,
    });
  });

  test('Escape closes inventory and returns focus to the HUD opener', async ({ page }) => {
    await start(page);
    const opener = page.locator('#hud-inventory');
    await opener.click();
    await expect(page.locator('#inventory-panel')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.locator('#inventory-panel')).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('Tab and Shift+Tab keep focus inside the inventory dialog', async ({ page }) => {
    await start(page);
    const panel = page.locator('#inventory-panel');
    await page.locator('#hud-inventory').click();
    await expect(panel).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(panel.locator(':focus')).toHaveCount(1);
    await page.keyboard.press('Shift+Tab');
    await expect(panel.locator(':focus')).toHaveCount(1);
  });
});
