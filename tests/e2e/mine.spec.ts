import { expect, test, type Page } from '@playwright/test';

/**
 * M4（P1）：礦坑。路線（座標以 content/maps 為準）：森林北門 (12,0) → 礦坑入口，出生點 (8,8)；
 * 入口的石頭 (1,2)（站在 (2,2) 面向左）；落石洞口 (7,1)（站在 (7,2) 面向上）；清開後走進第 1 層。
 */
interface Actor {
  id: string;
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

/** 從農場出生點走到礦坑入口的出生點 (8,8)。 */
async function toMineEntrance(page: Page): Promise<void> {
  await walk(page, 'ArrowUp', 2);
  await walk(page, 'ArrowRight', 32);
  await expect.poll(() => mapId(page)).toBe('forest');
  await walk(page, 'ArrowRight', 10);
  await walk(page, 'ArrowUp', 6);
  await walk(page, 'ArrowUp', 1);
  await expect.poll(() => mapId(page)).toBe('mine-entrance');
}

test('the pick breaks a rock for stone, and the fallen rock at the cave mouth can be cleared', async ({ page }) => {
  await waitForGame(page);
  await toMineEntrance(page);

  // 出生點 (8,8) → 往上到 (8,2)，往左到 (2,2)，面向左邊的石頭 (1,2)。
  await walk(page, 'ArrowUp', 6);
  await walk(page, 'ArrowLeft', 6);
  await page.keyboard.press('p');
  await expect(page.locator('#hud-tool')).toHaveText('鎬');
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('敲下了');
  await expect(page.locator('#hud-log')).toContainText('石頭');

  // 往右到 (7,2)，面向上方的洞口 (7,1)：清開落石。
  await walk(page, 'ArrowRight', 5);
  await walk(page, 'ArrowUp', 1);
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('清開了落石');

  // 再往上走進洞口，到第 1 層。
  await walk(page, 'ArrowUp', 1);
  await expect.poll(() => mapId(page)).toBe('mine-1');
});

test('without the pick the cave mouth stays shut and says what is needed', async ({ page }) => {
  await waitForGame(page);
  await toMineEntrance(page);
  // 出生點 (8,8) → 往上到 (8,2)，往左到 (7,2)，面向上方的洞口 (7,1)。沒有鎬：洞口不動。
  await walk(page, 'ArrowUp', 6);
  await walk(page, 'ArrowLeft', 1);
  await walk(page, 'ArrowUp', 1);
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('要用鎬才清得開');
  await walk(page, 'ArrowUp', 1);
  await expect.poll(() => mapId(page)).toBe('mine-entrance');
});
