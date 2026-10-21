import { expect, test, type Page } from '@playwright/test';

/**
 * 鏡頭捲動：農場（32×24 格，每格 64 px）比一個畫面（16×12 格）大，鏡頭必須跟著主角、
 * 不超出地圖邊界；村莊剛好一個畫面大，鏡頭不動。
 * 鏡頭位置由開發模式的 window.__dewhollow 提供（正式建置不含）。
 */
const FARM_MAX_SCROLL = { x: 32 * 64 - 16 * 64, y: 24 * 64 - 12 * 64 };

async function press(page: Page, key: string, times: number): Promise<void> {
  for (let i = 0; i < times; i += 1) await page.keyboard.press(key);
}

async function scroll(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow（需用開發伺服器執行）');
    return debug.cameraScroll();
  });
}

async function mapId(page: Page): Promise<string> {
  return page.evaluate(() => window.__dewhollow?.mapId() ?? '');
}

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#hud-day')).toHaveText('第 1 天');
  await expect.poll(() => mapId(page)).toBe('farm');
}

test('camera follows the player on the large farm and stays inside the map', async ({ page }) => {
  await waitForGame(page);

  // 出生點 (7,9)：左邊貼著地圖邊界，垂直方向置中於玩家（9×64+32−384 = 224）。
  await expect.poll(async () => scroll(page)).toEqual({ x: 0, y: 224 });

  // 往南走到最底（y=22），鏡頭應停在下邊界，不會露出地圖外。
  await press(page, 'ArrowDown', 13);
  await expect.poll(async () => (await scroll(page)).y).toBe(FARM_MAX_SCROLL.y);

  // 再往東走到 x=27，鏡頭應停在右邊界。
  await press(page, 'ArrowRight', 20);
  await expect.poll(async () => scroll(page)).toEqual(FARM_MAX_SCROLL);
});

test('camera is reframed when changing maps', async ({ page }) => {
  await waitForGame(page);

  // 走進南邊的門，進入剛好一個畫面大的村莊：鏡頭固定在原點。
  await press(page, 'ArrowDown', 14);
  await expect.poll(() => mapId(page)).toBe('village');
  await expect.poll(async () => scroll(page)).toEqual({ x: 0, y: 0 });

  // 從村莊的門回到農場：直接出現在農場南端，鏡頭貼著下邊界而不是從舊位置慢慢滑過來。
  await press(page, 'ArrowDown', 1);
  await expect.poll(() => mapId(page)).toBe('farm');
  await expect.poll(async () => (await scroll(page)).y).toBe(FARM_MAX_SCROLL.y);
});
