import { expect, test, type Page } from '@playwright/test';
import v24House from '../fixtures/saves/v24-house-layout.json' with { type: 'json' };

type SaveRecord = { slot: string; savedAt: string; state: Record<string, any> };

async function putRecord(page: Page, record: SaveRecord): Promise<void> {
  await page.evaluate((value) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(value);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }), record);
}

async function readState(page: Page): Promise<Record<string, any>> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('saves').objectStore('saves').get('slot-1');
      request.onsuccess = () => { db.close(); resolve(request.result.state); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  }));
}

test('v25 greenhouse saves move their player and crops into the independent room and can return to the farm', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();

  const record = structuredClone(v24House) as SaveRecord;
  record.state.schemaVersion = 25;
  record.state.mapId = 'farm';
  record.state.player = { x: 30, y: 22, facing: 'left' };
  record.state.flags = { greenhouse: true };
  const greenhouseCrop = { watered: true, crop: { cropId: 'bell-pumpkin', growthDays: 3 }, fertilizer: 'fine', dryDays: 0 };
  const farmCrop = { watered: false, crop: { cropId: 'moon-bean', growthDays: 1 }, dryDays: 0 };
  record.state.plots = { '31,22': greenhouseCrop, '4,3': farmCrop };
  await putRecord(page, record);

  await page.reload();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('greenhouse');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().player)).toEqual({ x: 3, y: 2, facing: 'left' });
  expect(await page.evaluate(() => window.__dewhollow?.gameState().plots)).toMatchObject({
    'greenhouse|7,2': greenhouseCrop,
    'farm|4,16': farmCrop,
  });

  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  expect(await readState(page)).toMatchObject({
    schemaVersion: 26,
    mapId: 'greenhouse',
    player: { x: 3, y: 2, facing: 'left' },
    plots: { 'greenhouse|7,2': greenhouseCrop, 'farm|4,16': farmCrop },
  });

  for (let step = 0; step < 5; step += 1) {
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().player.y)).toBe(3 + step);
  }
  for (let step = 0; step < 3; step += 1) {
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().player.x)).toBe(4 + step);
  }
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().player)).toMatchObject({ x: 7, y: 9 });
});
