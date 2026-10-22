import { expect, test, type Page } from '@playwright/test';

/**
 * 星河兌換（夜市）：節慶面板上用星河碎片換物品。這個檔案已寫好，但這次沒有執行（依照指示避開 5173 port，不跑 npm run test:e2e）。
 * 作法與 festival.spec.ts 相同：先存一個新遊戲，改寫存檔裡的日期、位置與背包，重新讀取，再到鎮廣場操作。
 * 兌換的規則（上限、碎片不足、旗標）已由單元測試涵蓋；這裡只看面板的按鈕與文字是否通。
 */

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function putRecord(page: Page, record: unknown): Promise<void> {
  await page.evaluate(
    (value) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('dewhollow-farm');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(value);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    record,
  );
}

async function readRecord(page: Page): Promise<{ slot: string; savedAt: string; state: Record<string, unknown> }> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('dewhollow-farm');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction('saves').objectStore('saves').get('slot-1');
          get.onsuccess = () => {
            open.result.close();
            resolve(get.result);
          };
          get.onerror = () => reject(get.error);
        };
      }),
  );
}

/** 把目前的存檔改成指定的內容（日期、地點、背包…），然後重新載入。 */
async function seedAndReload(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  const record = await readRecord(page);
  await putRecord(page, { ...record, state: { ...record.state, ...patch } });
  await page.reload();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
}

test('the star exchange trades shards for a decoration from the festival panel', async ({ page }) => {
  await waitForGame(page);
  await seedAndReload(page, {
    calendar: { year: 1, season: 'summer', day: 14, minuteOfDay: 1200 },
    mapId: 'plaza',
    player: { x: 1, y: 9, facing: 'up' },
    inventory: { capacity: 24, stacks: [{ itemId: 'star-shard', quality: 'normal', count: 5 }] },
  });

  await page.keyboard.press('x');
  await expect(page.locator('#festival-list')).toContainText('星河兌換');
  const row = page.locator('#festival-list li', { hasText: '星空燈串' });
  await row.getByRole('button', { name: '兌換' }).click();
  await expect(page.locator('#hud-log')).toContainText('星河兌換');
});

test('with too few shards the exchange button is off and the panel says why', async ({ page }) => {
  await waitForGame(page);
  await seedAndReload(page, {
    calendar: { year: 1, season: 'summer', day: 14, minuteOfDay: 1200 },
    mapId: 'plaza',
    player: { x: 1, y: 9, facing: 'up' },
    inventory: { capacity: 24, stacks: [{ itemId: 'star-shard', quality: 'normal', count: 1 }] },
  });

  await page.keyboard.press('x');
  const row = page.locator('#festival-list li', { hasText: '星空燈串' });
  await expect(row).toContainText('星河碎片不夠');
  await expect(row.getByRole('button', { name: '兌換' })).toBeDisabled();
});
