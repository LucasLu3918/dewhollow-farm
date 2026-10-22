import { expect, test, type Page } from '@playwright/test';

/**
 * 技能天賦與鐮刀的畫面行為。存檔是一份 v11 的存檔（農耕已經 5 級、還沒選天賦），
 * 讀取後會遷移成 v12，玩家可以在技能面板選一個天賦。
 */
const V11_RECORD = {
  slot: 'slot-1',
  savedAt: '2026-10-22T10:00:00.000Z',
  state: {
    schemaVersion: 11,
    calendar: { year: 1, season: 'spring', day: 4, minuteOfDay: 400 },
    weather: 'sunny',
    forecast: 'sunny',
    energy: { current: 60, max: 100 },
    gold: 250,
    mapId: 'farm',
    player: { x: 7, y: 9, facing: 'down' },
    plots: {},
    inventory: { capacity: 24, stacks: [] },
    shipBox: { entries: [] },
    flags: {},
    tool: 'hoe',
    toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0 },
    worldChanges: {},
    skills: { farming: 200, foraging: 0, fishing: 0, mining: 0, cooking: 0 },
    fishing: null,
    animals: [],
    processing: [],
    mineSeed: 9,
    mineCheckpoint: 1,
    selectedSeed: 'moon-bean',
    rng: 12345,
    playtimeSeconds: 0,
  },
};

/** 直接寫入遊戲使用的 IndexedDB（資料庫由遊戲啟動時建立）。 */
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

async function readRecord(page: Page): Promise<{ state: Record<string, unknown> }> {
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

test('a skill at level 5 offers its two talents, and the chosen one is saved', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await putRecord(page, V11_RECORD);

  await page.reload();
  await expect(page.locator('#hud-skills')).toContainText('有 1 項可選天賦');

  await page.keyboard.press('k');
  await expect(page.locator('#skill-panel')).toBeVisible();
  await page.locator('#skill-list').getByRole('button', { name: /豐收手/ }).click();
  await expect(page.locator('#hud-log')).toContainText('選定了天賦「豐收手」');
  await expect(page.locator('#skill-list')).toContainText('已選：豐收手');

  await page.keyboard.press('Escape');
  await expect(page.locator('#skill-panel')).toBeHidden();

  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  const saved = await readRecord(page);
  expect(saved.state.schemaVersion).toBe(22);
  expect(saved.state.talents).toEqual({ farming: 'bountiful' });
  expect(saved.state.toolTiers).toHaveProperty('sickle', 0);
});

test('G takes the sickle into hand, and the status bar shows it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await page.keyboard.press('g');
  await expect(page.locator('#hud-tool')).toHaveText('鐮刀');
});
