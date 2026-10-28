import { expect, test, type Page } from '@playwright/test';
import v23 from '../fixtures/saves/v23-house-wing.json' with { type: 'json' };

const nodeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
const BASE = nodeProcess?.env?.PWA_BASE_URL ?? 'http://127.0.0.1:4173';

test.use({ baseURL: BASE });

type SavedRecord = {
  slot: string;
  savedAt: string;
  state: Record<string, unknown>;
};

async function waitForGame(page: Page): Promise<void> {
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#hud-day')).not.toHaveText('');
}

async function writeRecord(page: Page, record: unknown): Promise<void> {
  await page.evaluate((value) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put(value);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
    };
  }), record);
}

async function readRecord(page: Page): Promise<SavedRecord> {
  return page.evaluate(() => new Promise<SavedRecord>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const request = database.transaction('saves').objectStore('saves').get('slot-1');
      request.onsuccess = () => { database.close(); resolve(request.result as SavedRecord); };
      request.onerror = () => { database.close(); reject(request.error); };
    };
  }));
}

function expectMigratedV23State(state: Record<string, unknown>): void {
  expect(state).toMatchObject({
    schemaVersion: 25,
    mapId: 'house-wing',
    player: { x: 10, y: 12, facing: 'up' },
    plots: v23.state.plots,
    inventory: v23.state.inventory,
    shipBox: v23.state.shipBox,
    flags: v23.state.flags,
    gold: 1250,
    hotbar: [null, null, null, null],
    decor: { 'house-wing': [{ itemId: 'night-canvas', x: 17, y: 11 }] },
  });
}

test('migrates the v23 house save and saves, reads, and reloads it offline', async ({ page, context }) => {
  try {
    await page.goto('/');
    await waitForGame(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await waitForGame(page);
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    await writeRecord(page, v23);
    await page.reload();
    await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
    await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 4 天');
    await expect(page.locator('#hud-gold')).toHaveText('1250 金');

    await context.setOffline(true);
    await page.keyboard.press('s');
    await expect(page.locator('#hud-log')).toContainText('已存檔');
    expectMigratedV23State((await readRecord(page)).state);

    await page.reload();
    await waitForGame(page);
    await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
    await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 4 天');
    await expect(page.locator('#hud-gold')).toHaveText('1250 金');
    expectMigratedV23State((await readRecord(page)).state);
  } finally {
    await context.setOffline(false);
  }
});
