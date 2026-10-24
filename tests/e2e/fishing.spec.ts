import { expect, test, type Page } from '@playwright/test';

/**
 * M4（P1）：釣魚與技能。路線：農場出生點 → 森林 (2,7) → 上到 (2,5) → 右到 (22,5) → 下到 (22,6) → 進湖畔的門 (23,6)，
 * 落在湖畔 (1,7)，面向上方的水 (1,6)。上不上鉤由隨機數決定，所以反覆投竿直到上鉤。
 */
interface Actor {
  id: string;
  busy: boolean;
  tileX: number;
  tileY: number;
}

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function mapId(page: Page): Promise<string> {
  return page.evaluate(() => window.__dewhollow?.mapId() ?? '');
}

async function playerPosition(page: Page): Promise<{ x: number; y: number }> {
  const actors = (await page.evaluate(() => window.__dewhollow?.actors() ?? [])) as Actor[];
  const player = actors.find((actor) => actor.id === 'player');
  if (!player) throw new Error('找不到玩家');
  return { x: player.tileX, y: player.tileY };
}

async function walk(page: Page, key: string, steps: number): Promise<void> {
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press(key);
    await expect
      .poll(async () => {
        const actors = (await page.evaluate(() => window.__dewhollow?.actors() ?? [])) as Actor[];
        return actors.find((a) => a.id === 'player')?.busy ?? true;
      })
      .toBe(false);
  }
}

async function toLake(page: Page): Promise<void> {
  await walk(page, 'ArrowUp', 2);
  await walk(page, 'ArrowRight', 32);
  await expect.poll(() => mapId(page)).toBe('forest');
  await walk(page, 'ArrowUp', 2);
  await walk(page, 'ArrowRight', 20);
  await walk(page, 'ArrowDown', 1);
  await walk(page, 'ArrowRight', 1);
  await expect.poll(() => mapId(page)).toBe('lake');
  // 從門走進來時面向右；往上按一下，水擋住所以不會動，但會面向水。
  await walk(page, 'ArrowUp', 1);
}

/** Save a known RNG state so the bite/reel checks do not depend on a fresh-game seed. */
async function setFishingRng(page: Page, rng: number): Promise<void> {
  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  await page.evaluate((nextRng) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('dewhollow-farm');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('saves', 'readwrite');
      const store = transaction.objectStore('saves');
      const get = store.get('slot-1');
      get.onerror = () => reject(get.error);
      get.onsuccess = () => {
        const record = get.result as { state: { rng: number } } | undefined;
        if (!record) {
          db.close();
          reject(new Error('找不到釣魚測試存檔'));
          return;
        }
        record.state.rng = nextRng;
        store.put(record);
      };
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }), rng);
  await page.reload();
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
}

test('the status line shows every skill level, starting at zero', async ({ page }) => {
  await waitForGame(page);
  await expect(page.locator('#hud-skills')).toContainText('耕作 0');
  await expect(page.locator('#hud-skills')).toContainText('釣魚 0');
  await expect(page.locator('#hud-skills')).toContainText('烹飪 0');
});

test('casting at the lake with the rod: a fish bites sometimes, and a quick press reels it in', async ({ page }) => {
  test.setTimeout(90_000);
  await waitForGame(page);
  await toLake(page);
  await page.keyboard.press('r');
  await expect(page.locator('#hud-tool')).toHaveText('釣竿');
  await setFishingRng(page, 2_654_435_761); // first cast deterministically bites (same LCG as the domain tests).

  await page.keyboard.press('x');
  await expect(page.locator('#hud-log li').last()).toContainText('魚上鉤了');

  // 上鉤期間方向輸入被閘門擋下，玩家位置不變；互動鍵仍能在時限內收線。
  const beforeReel = await playerPosition(page);
  await page.keyboard.down('ArrowDown');
  await page.keyboard.press('x');
  await page.keyboard.up('ArrowDown');
  expect(await playerPosition(page)).toEqual(beforeReel);
  await expect(page.locator('#hud-log')).toContainText('釣到了');
  // 投竿每次給 6 點釣魚經驗，所以技能列上的等級會跟著上升（這裡只檢查它顯示出來）。
  await expect(page.locator('#hud-skills')).toContainText('釣魚');
});

test('a fish that is not reeled in within the window gets away', async ({ page }) => {
  test.setTimeout(90_000);
  await waitForGame(page);
  await toLake(page);
  await page.keyboard.press('r');
  await setFishingRng(page, 2_654_435_761);
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log li').last()).toContainText('魚上鉤了');
  await expect(page.locator('#hud-log')).toContainText('魚跑掉了', { timeout: 5000 });
});
