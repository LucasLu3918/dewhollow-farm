import { expect, test, type Page } from '@playwright/test';
import v1 from '../fixtures/saves/v1-farm.json' with { type: 'json' };
import v23 from '../fixtures/saves/v23-house-wing.json' with { type: 'json' };
import v24 from '../fixtures/saves/v24-farm.json' with { type: 'json' };
import { parseSaveRecord } from '../../src/infrastructure/persistence/save-schema';

// 固定合成存檔，不取用真實玩家資料。每個測試使用獨立 Playwright context。
const context = { inventoryCapacity: 24, daysPerSeason: 20, wakeMinute: 360, playerName: '小涵' };
const fixtures = [['v1 farm', v1], ['v23 house-wing', v23], ['v24 farm', v24]] as const;

async function putRecord(page: Page, record: unknown): Promise<void> {
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

async function readRecord(page: Page, slot: string): Promise<unknown> {
  return page.evaluate((key) => new Promise((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('saves').objectStore('saves').get(key);
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  }), slot);
}

for (const [name, fixture] of fixtures) {
  test(`${name} preserves world data through save and reload`, async ({ page }) => {
    const expected = parseSaveRecord(fixture, context).state;
    const sentinel = { ...v1, slot: 'slot-2' };
    await page.goto('/');
    await expect(page.locator('#game canvas')).toBeVisible();
    await putRecord(page, fixture);
    await putRecord(page, sentinel);
    await page.reload();
    await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe(expected.mapId);

    const assertState = async () => {
      const state = await page.evaluate(() => window.__dewhollow!.gameState());
      expect(state).toMatchObject({ schemaVersion: 24, mapId: expected.mapId, player: expected.player,
        plots: expected.plots, inventory: expected.inventory, shipBox: expected.shipBox,
        decor: expected.decor, flags: expected.flags, gold: expected.gold, hotbar: expected.hotbar });
    };
    await assertState();
    for (let cycle = 0; cycle < 2; cycle += 1) {
      await page.keyboard.press('s');
      await expect(page.locator('#hud-log')).toContainText('已存檔');
      await page.reload();
      await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
      await assertState();
    }
    expect(await readRecord(page, 'slot-2')).toEqual(sentinel);
  });
}
