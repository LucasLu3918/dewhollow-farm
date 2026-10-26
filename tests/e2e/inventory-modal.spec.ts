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

  test('I toggles the inventory modal and C opens the collection by default', async ({ page }) => {
    await start(page);

    await page.keyboard.press('i');
    await expect(page.locator('#inventory-panel')).toBeVisible();
    await page.keyboard.press('i');
    await expect(page.locator('#inventory-panel')).toBeHidden();

    await page.keyboard.press('c');
    await expect(page.locator('#collection-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#collection-panel')).toBeHidden();
  });

  test('arrow keys focus occupied grid slots and Enter selects the exact stack', async ({ page }) => {
    await start(page);
    const panel = page.locator('#inventory-panel');
    await page.keyboard.press('i');
    await expect(panel).toBeVisible();
    const items = panel.locator('#inventory-grid [data-slot-state="item"]');
    await expect(items).toHaveCount(2);

    const first = items.nth(0);
    await expect(first).toBeFocused();
    await page.keyboard.press('ArrowRight');
    const second = items.nth(1);
    await expect(second).toBeFocused();
    const exact = await second.evaluate((element) => ({
      itemId: element.getAttribute('data-item-id'),
      quality: element.getAttribute('data-quality'),
      count: element.getAttribute('data-count'),
    }));
    await page.keyboard.press('Enter');
    await expect(panel.locator('#inventory-detail')).toHaveAttribute('data-state', 'selected');
    await expect(panel.locator('#inventory-detail')).toHaveAttribute('data-item-id', exact.itemId ?? '');
    await expect(panel.locator('#inventory-detail')).toHaveAttribute('data-quality', exact.quality ?? '');
    await expect(panel.locator('#inventory-detail')).toHaveAttribute('data-count', exact.count ?? '');
  });

  test('a modal cancels a held movement and blocks movement, actions, music, and mute keys', async ({ page }) => {
    await start(page);
    await page.keyboard.down('ArrowRight');
    await expect.poll(async () => (await movement(page)).heldDirection).not.toBeNull();
    await page.keyboard.press('i');
    await expect(page.locator('#inventory-panel')).toBeVisible();
    await expect.poll(async () => {
      const current = await movement(page);
      return current.heldDirection === null && !current.moving && !current.pending && current.queuedTaps === 0;
    }).toBe(true);

    await page.locator('#inventory-close').focus();

    const beforeActions = await page.evaluate(() => ({
      muted: window.__dewhollow?.muted(),
      musicPlaying: window.__dewhollow?.musicPlaying(),
      messages: document.querySelector('.messages')?.textContent ?? '',
      tile: window.__dewhollow?.movement().tile,
    }));
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('x');
    await page.keyboard.press('z');
    await page.keyboard.press('b');
    await page.keyboard.press('m');
    const afterActions = await page.evaluate(() => ({
      muted: window.__dewhollow?.muted(),
      musicPlaying: window.__dewhollow?.musicPlaying(),
      messages: document.querySelector('.messages')?.textContent ?? '',
      tile: window.__dewhollow?.movement().tile,
    }));
    expect(afterActions).toEqual(beforeActions);
    await page.keyboard.up('ArrowRight');
  });
});
