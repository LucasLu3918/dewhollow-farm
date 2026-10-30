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

for (const mapId of ['house', 'house-wing', 'house-full']) {
  test(`v24 ${mapId} saves enter, leave and persist in the remodeled room`, async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#game canvas')).toBeVisible();

    const record = structuredClone(v24House) as SaveRecord;
    record.state.mapId = mapId;
    record.state.flags = mapId === 'house'
      ? {}
      : mapId === 'house-wing' ? { 'house-wing': true } : { 'house-wing': true, 'house-full': true };
    await putRecord(page, record);
    await page.reload();

    await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe(mapId);
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().schemaVersion ?? 0)).toBe(26);
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().player)).toEqual({ x: 10, y: 12, facing: 'up' });
    expect(await page.evaluate(() => window.__dewhollow?.gameState().decor['house-wing'])).toEqual([
      { itemId: 'night-canvas', x: 17, y: 11 },
    ]);
    expect(await page.evaluate(() => window.__dewhollow?.gameState().plots['farm|4,16'])).toMatchObject({
      watered: true,
      crop: { cropId: 'moon-bean', growthDays: 1 },
    });

    // Walk the shared entrance spine to the house door.
    for (let y = 13; y <= 18; y += 1) {
      await page.keyboard.press('ArrowDown');
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().player.y ?? -1)).toBe(y);
    }
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
    const farmSpawn = mapId === 'house'
      ? { x: 27, y: 10 }
      : { x: 2, y: 5 };
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().player)).toMatchObject(farmSpawn);

    // Re-enter through the farm portal; expansion flags select the matching room.
    await expect.poll(() => page.evaluate(() => {
      const movement = window.__dewhollow?.movement();
      return movement && movement.heldDirection === null && !movement.moving && !movement.pending && movement.queuedTaps === 0;
    })).toBe(true);
    if (mapId === 'house') {
      await page.keyboard.press('ArrowUp');
    } else {
      for (let y = 6; y <= 9; y += 1) {
        await page.keyboard.press('ArrowDown');
        await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().player.y ?? -1)).toBe(y);
      }
      for (let x = 3; x <= 26; x += 1) {
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().player.x ?? -1)).toBe(x);
      }
      await page.keyboard.press('ArrowRight');
    }
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe(mapId);
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().player)).toMatchObject({ x: 10, y: 18 });

    await page.keyboard.press('s');
    await expect(page.locator('#hud-log')).toContainText('已存檔');
    const saved = await readState(page);
    expect(saved).toMatchObject({ schemaVersion: 26, mapId, player: { x: 10, y: 18 }, plots: { 'farm|4,16': record.state.plots['4,3'] } });
    expect(saved.decor['house-wing']).toEqual([{ itemId: 'night-canvas', x: 17, y: 11 }]);
  });
}
