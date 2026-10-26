import { expect, test, type Page } from '@playwright/test';

/**
 * M5d：圖鑑與成就面板（預設按 C 開關）。
 * 作法：先存一個新遊戲，改寫存檔裡的圖鑑與成就紀錄，重新讀取，再按 C 看面板的內容。
 * 規則與內容已由單元測試涵蓋；這裡只看畫面路線是否通。
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

/** 把目前的存檔改成指定的內容，然後重新載入。 */
async function seedAndReload(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  const record = await readRecord(page);
  await putRecord(page, { ...record, state: { ...record.state, ...patch } });
  await page.reload();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
}

test('pressing C opens the collection and achievements panel, with all seven categories and the achievement list', async ({ page }) => {
  await waitForGame(page);
  await page.keyboard.press('c');
  await expect(page.locator('#collection-panel')).toBeVisible();
  await expect(page.locator('#collection-list')).toContainText('魚：');
  await expect(page.locator('#collection-list')).toContainText('野菜與花：');
  await expect(page.locator('#collection-list')).toContainText('第一次收成');
  await page.keyboard.press('Escape');
  await expect(page.locator('#collection-panel')).toBeHidden();
});

test('a discovered fish and an unlocked achievement show up in the panel', async ({ page }) => {
  await waitForGame(page);
  await seedAndReload(page, {
    collection: { found: ['fish.carp'], claimed: [] },
    achievements: { unlocked: ['first-catch'], counters: { harvest: 1 }, titles: [] },
  });
  await page.keyboard.press('c');
  await expect(page.locator('#collection-summary')).toContainText('圖鑑 1/');
  await expect(page.locator('#collection-list')).toContainText('鯉魚');
  await expect(page.locator('#collection-list')).toContainText('第一條魚（已達成）');
});
