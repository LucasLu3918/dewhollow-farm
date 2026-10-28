import { expect, test, type Page } from '@playwright/test';

/**
 * M3 的世界：農場通往山腳森林，森林通往月鏡湖畔（門與落點寫在 content/maps/*.json）；
 * 水與樹擋路；HUD 顯示今天的天氣與明天的預報。
 */
interface Actor {
  id: string;
  tileX: number;
  tileY: number;
  busy: boolean;
}

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function mapId(page: Page): Promise<string> {
  return page.evaluate(() => window.__dewhollow?.mapId() ?? '');
}

async function player(page: Page): Promise<Actor> {
  const actors = (await page.evaluate(() => window.__dewhollow?.actors() ?? [])) as Actor[];
  const found = actors.find((a) => a.id === 'player');
  if (!found) throw new Error('找不到玩家');
  return found;
}

/** 一步一步走，每步等玩家真的站定，避免按鍵被丟掉。 */
async function walk(page: Page, key: string, steps: number): Promise<void> {
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press(key);
    await expect.poll(async () => (await player(page)).busy).toBe(false);
  }
}

test('the status line shows the date and tomorrow\'s forecast', async ({ page }) => {
  await waitForGame(page);
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 1 天');
  await expect(page.locator('#hud-weather')).toContainText('明天：');
});

test('the farm leads east into the forest, and the forest leads on to the lake and back', async ({ page }) => {
  await waitForGame(page);
  // 出生點 (7,9)：往上到 (7,7)，再一路往右到農場東側的門 (39,7)。
  await walk(page, 'ArrowUp', 2);
  await walk(page, 'ArrowRight', 32);
  await expect.poll(() => mapId(page)).toBe('forest');

  // 森林出生點 (2,7)：往上到 (2,5)，右到 (22,5)，下到 (22,6)，再往右走進湖畔的門 (23,6)。
  await walk(page, 'ArrowUp', 2);
  await walk(page, 'ArrowRight', 20);
  await walk(page, 'ArrowDown', 1);
  await walk(page, 'ArrowRight', 1);
  await expect.poll(() => mapId(page)).toBe('lake');

  // 湖畔的門 (0,7) 回到森林的 (22,6)。
  await walk(page, 'ArrowLeft', 2);
  await expect.poll(() => mapId(page)).toBe('forest');
  await expect.poll(async () => ({ x: (await player(page)).tileX, y: (await player(page)).tileY })).toEqual({ x: 22, y: 6 });
});

test('water and trees block the way: walking into the lake does not move you', async ({ page }) => {
  await waitForGame(page);
  await walk(page, 'ArrowUp', 2);
  await walk(page, 'ArrowRight', 32);
  await expect.poll(() => mapId(page)).toBe('forest');
  await walk(page, 'ArrowUp', 2);
  await walk(page, 'ArrowRight', 20);
  await walk(page, 'ArrowDown', 1);
  await walk(page, 'ArrowRight', 1);
  await expect.poll(() => mapId(page)).toBe('lake');

  // 湖畔 (1,7) 往上是水：位置不變。
  const before = await player(page);
  await walk(page, 'ArrowUp', 1);
  const after = await player(page);
  expect({ x: after.tileX, y: after.tileY }).toEqual({ x: before.tileX, y: before.tileY });
});

test('a whole year of sleeping passes through every season without a page error', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await waitForGame(page);

  // 出生點 (7,9)：走進小屋後，從 (10,18) 前往床邊 (4,8)，面向床。之後每按一次 x 就睡一晚。
  await walk(page, 'ArrowUp', 4);
  await walk(page, 'ArrowLeft', 5);
  await walk(page, 'ArrowUp', 1);
  await expect.poll(() => mapId(page)).toBe('house');
  // 工作台位於南側，沿入口走道往北再轉西到床邊。
  await walk(page, 'ArrowUp', 9);
  await walk(page, 'ArrowLeft', 6);
  await walk(page, 'ArrowUp', 1);

  const seasons: [number, string][] = [
    [20, '現在是夏天'],
    [40, '現在是秋天'],
    [60, '現在是冬天'],
    [80, '現在是春天'],
  ];
  let slept = 0;
  for (const [target, message] of seasons) {
    while (slept < target) {
      await page.keyboard.press('x');
      slept += 1;
      await expect
        .poll(() => page.evaluate(() => (window.__dewhollow?.effectLog() ?? []).filter((e) => e.name === 'slept').length))
        .toBe(slept);
    }
    await expect(page.locator('#hud-log')).toContainText(message);
  }
  await expect(page.locator('#hud-day')).toHaveText('第 2 年 春 第 1 天');
  expect(errors).toEqual([]);
});

test('the farmhouse has its bed inside, and furniture blocks the way', async ({ page }) => {
  await waitForGame(page);
  // 田邊 (7,9) → (7,5) → (2,5)，走進小屋的門 (2,4)，落在新入口 (10,18)。
  await walk(page, 'ArrowUp', 4);
  await walk(page, 'ArrowLeft', 5);
  await walk(page, 'ArrowUp', 1);
  await expect.poll(() => mapId(page)).toBe('house');
  await expect.poll(async () => ({ x: (await player(page)).tileX, y: (await player(page)).tileY })).toEqual({ x: 10, y: 18 });

  // 走到廚房 (18,6) 下方，向上嘗試進入家具應被阻擋。
  await walk(page, 'ArrowUp', 9);
  await walk(page, 'ArrowRight', 8);
  await walk(page, 'ArrowUp', 2);
  await walk(page, 'ArrowUp', 1);
  await expect.poll(async () => ({ x: (await player(page)).tileX, y: (await player(page)).tileY })).toEqual({ x: 18, y: 7 });
});

test('the forest\'s north door leads to the mine entrance, where a fallen rock blocks the cave', async ({ page }) => {
  await waitForGame(page);
  await walk(page, 'ArrowUp', 2);
  await walk(page, 'ArrowRight', 32);
  await expect.poll(() => mapId(page)).toBe('forest');

  // 森林出生點 (2,7) → 往右到 (12,7)，往上到 (12,1)，再往上穿過北門 (12,0)。
  await walk(page, 'ArrowRight', 10);
  await walk(page, 'ArrowUp', 6);
  await walk(page, 'ArrowUp', 1);
  await expect.poll(() => mapId(page)).toBe('mine-entrance');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.actors().some((actor) => actor.id === 'player') ?? false)).toBe(true);

  // 礦坑入口的出生點 (8,8) → 往上到 (8,2)，左一步到 (7,2)，朝上碰到洞口。
  await walk(page, 'ArrowUp', 6);
  await walk(page, 'ArrowLeft', 1);
  await walk(page, 'ArrowUp', 1);
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('落石擋住了礦坑入口');
  await expect(page.locator('#hud-energy-text')).toHaveText('100 / 100');
});
