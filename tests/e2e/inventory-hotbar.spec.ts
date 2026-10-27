import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../../src/domain/game-state';

async function start(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
}

async function writeState(page: Page, state: GameState): Promise<void> {
  await page.evaluate((value) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put({ slot: 'slot-1', savedAt: new Date().toISOString(), state: value });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  }), state);
}

async function readSavedState(page: Page): Promise<GameState> {
  return page.evaluate(() => new Promise<GameState>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const request = database.transaction('saves').objectStore('saves').get('slot-1');
      request.onsuccess = () => { database.close(); resolve(request.result.state); };
      request.onerror = () => reject(request.error);
    };
  }));
}

async function assign(page: Page, slot: number, entryId: string): Promise<void> {
  await page.locator('#quickbar-toggle').click();
  await page.locator('[data-hotbar-edit-mode]').click();
  await page.locator(`[data-hotbar-use="${slot}"]`).click();
  await expect(page.locator('#tool-seed-panel')).toBeVisible();
  await expect(page.locator('#tool-seed-title')).toHaveText(`設定快捷欄第${slot + 1}格`);
  await page.locator(`#tool-seed-list [data-selector-id="${entryId}"]`).click();
  await expect(page.locator('#tool-seed-panel')).toBeHidden();
}

test('assigns tools and owned seeds, uses keyboard and touch, and persists them per save', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true });
  const page = await context.newPage();
  try {
  await start(page);
  const slots = page.locator('#quickbar [data-hotbar-use]');
  await expect(slots).toHaveCount(4);
  await expect(slots.nth(0)).toBeDisabled();

  await assign(page, 0, 'tool:axe');
  await assign(page, 1, 'seed:moon-bean');
  await expect.poll(() => page.evaluate(() => window.__dewhollow!.gameState().hotbar)).toEqual([
    { kind: 'tool', tool: 'axe' },
    { kind: 'seed', cropId: 'moon-bean' },
    null,
    null,
  ]);

  const before = await page.evaluate(() => window.__dewhollow!.gameState());
  await page.locator('#quickbar-toggle').click();
  await slots.nth(0).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__dewhollow!.gameState().tool)).toBe('axe');
  await page.locator('#quickbar-toggle').click();
  await slots.nth(1).tap();
  await expect.poll(() => page.evaluate(() => window.__dewhollow!.gameState().selectedSeed)).toBe('moon-bean');
  expect(await page.evaluate(() => window.__dewhollow!.gameState().inventory)).toEqual(before.inventory);

  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  expect((await readSavedState(page)).hotbar).toEqual(before.hotbar);
  await page.reload();
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  expect((await page.evaluate(() => window.__dewhollow!.gameState())).hotbar).toEqual(before.hotbar);
  } finally {
    await context.close();
  }
});

test('migrates a v23 save to four empty quickbar slots and saves as v24', async ({ page }) => {
  await start(page);
  const old = await page.evaluate(() => window.__dewhollow!.gameState());
  old.schemaVersion = 23 as GameState['schemaVersion'];
  delete (old as Partial<GameState>).hotbar;
  await writeState(page, old);
  await page.reload();
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  const migrated = await page.evaluate(() => window.__dewhollow!.gameState());
  expect(migrated.schemaVersion).toBe(24);
  expect(migrated.hotbar).toEqual([null, null, null, null]);

  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  expect((await readSavedState(page)).schemaVersion).toBe(24);
  expect((await readSavedState(page)).hotbar).toEqual([null, null, null, null]);
});

test('a depleted seed slot is disabled and leaves the inventory unchanged', async ({ page }) => {
  await start(page);
  const state = await page.evaluate(() => window.__dewhollow!.gameState());
  state.hotbar[0] = { kind: 'seed', cropId: 'moon-bean' };
  state.inventory.stacks = state.inventory.stacks.filter((stack) => stack.itemId !== 'seed.moon-bean');
  await writeState(page, state);
  await page.reload();
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');

  const slot = page.locator('[data-hotbar-use="0"]');
  await expect(slot).toContainText('已用完');
  await expect(slot).toBeDisabled();
  const before = await page.evaluate(() => window.__dewhollow!.gameState().inventory);
  await slot.evaluate((button) => (button as HTMLButtonElement).click());
  expect(await page.evaluate(() => window.__dewhollow!.gameState().inventory)).toEqual(before);
});

test('the compact viewport opens its quickbar without reducing the game stage', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await start(page);
  const stageBounds = await page.locator('#game').boundingBox();
  const toggle = page.locator('#quickbar-toggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator('#quickbar [data-hotbar-use]')).toHaveCount(4);
  const openedStageBounds = await page.locator('#game').boundingBox();
  expect(openedStageBounds?.height).toBe(stageBounds?.height);

  await page.locator('[data-hotbar-edit-mode]').click();
  await page.locator('[data-hotbar-use="0"]').click();
  await page.locator('#tool-seed-list [data-selector-id="tool:axe"]').click();
  await toggle.click();
  await page.locator('[data-hotbar-use="0"]').click();
  await expect.poll(() => page.evaluate(() => window.__dewhollow!.gameState().tool)).toBe('axe');
});

test('the quickbar toggle leaves game movement input available', async ({ page }) => {
  await start(page);
  const startX = await page.evaluate(() => window.__dewhollow!.gameState().player.x);
  await page.locator('#quickbar-toggle').click();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__dewhollow!.gameState().player.x)).toBe(startX + 1);
});
