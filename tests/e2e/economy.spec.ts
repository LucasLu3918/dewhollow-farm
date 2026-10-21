import { expect, test, type Page } from '@playwright/test';

/**
 * M4（P0）：採集與砍伐、雜貨店、鐵匠。
 * 路線（以 content/maps 的座標為準）：農場南門 (7,29) → 村莊；村莊雜貨店櫃檯 (3,4)、鐵匠櫃檯 (12,4)；
 * 森林：農場東門 (39,7) → 森林，樹 (3,2)、野薄荷 (2,9)。
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

/** 一步一步走，每步等玩家真的站定。 */
async function walk(page: Page, key: string, steps: number): Promise<void> {
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press(key);
    await expect.poll(async () => (await player(page)).busy).toBe(false);
  }
}

/** 從農場出生點走到森林的 (2,7)。 */
async function toForest(page: Page): Promise<void> {
  await walk(page, 'ArrowUp', 2);
  await walk(page, 'ArrowRight', 32);
  await expect.poll(() => mapId(page)).toBe('forest');
}

/** 從農場出生點走到村莊的 (7,10)。 */
async function toVillage(page: Page): Promise<void> {
  await walk(page, 'ArrowDown', 20);
  await expect.poll(() => mapId(page)).toBe('village');
}

test('an axe chops a tree in the forest: wood comes, and the tree is gone', async ({ page }) => {
  await waitForGame(page);
  await toForest(page);
  // 森林 (2,7) → 往上到 (2,2)，面向右邊的樹 (3,2)。
  await walk(page, 'ArrowUp', 5);
  await walk(page, 'ArrowRight', 1);
  await page.keyboard.press('a');
  await expect(page.locator('#hud-tool')).toHaveText('斧頭');
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('砍下了');
  await expect(page.locator('#hud-log')).toContainText('木材');
  await expect(page.locator('#hud-energy-text')).toHaveText('97 / 100');

  // 樹被砍掉後那一格是草地：再按一次沒有東西可以砍。
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('這裡沒有可以互動的東西');
});

test('wild mint can be picked once a day, and the spot is named when it is empty', async ({ page }) => {
  await waitForGame(page);
  await toForest(page);
  // 森林 (2,7) → 往下到 (2,8)，面向野薄荷 (2,9)。
  await walk(page, 'ArrowDown', 1);
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('採到了');
  await expect(page.locator('#hud-energy-text')).toHaveText('99 / 100');
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('這裡已經採過了');
});

test('the general store sells seeds: a click on 買一個 takes the gold', async ({ page }) => {
  await waitForGame(page);
  await toVillage(page);
  // 村莊 (7,10) → 往上到 (7,5)，往左到 (3,5)，面向上方的雜貨店櫃檯 (3,4)。
  await walk(page, 'ArrowUp', 5);
  await walk(page, 'ArrowLeft', 4);
  await walk(page, 'ArrowUp', 1);
  await page.keyboard.press('x');
  await expect(page.locator('#shop-panel')).toBeVisible();
  await expect(page.locator('#shop-title')).toHaveText('雜貨店');
  await expect(page.locator('#hud-gold')).toHaveText('100 金');

  await page.locator('#shop-list li').first().getByRole('button', { name: '買一個' }).click();
  await expect(page.locator('#hud-gold')).toHaveText('90 金');
  await expect(page.locator('#hud-log')).toContainText('買了');

  await page.keyboard.press('Escape');
  await expect(page.locator('#shop-panel')).toBeHidden();
});

test('the smithy shows the price and refuses an upgrade the player cannot pay for, taking nothing', async ({ page }) => {
  await waitForGame(page);
  await toVillage(page);
  // 村莊 (7,10) → 往上到 (7,6)，沿第 6 列往右到 (12,6)（毛毛站在 (10,5)，所以不走第 5 列），
  // 再往上到 (12,5)，面向上方的鐵匠櫃檯 (12,4)。
  await walk(page, 'ArrowUp', 4);
  await walk(page, 'ArrowRight', 5);
  await walk(page, 'ArrowUp', 2);
  await page.keyboard.press('x');
  await expect(page.locator('#shop-title')).toHaveText('鐵匠');
  await expect(page.locator('#shop-list')).toContainText('鋤頭 → 銅級');

  await page.locator('#shop-list li', { hasText: '鋤頭 → 銅級' }).getByRole('button', { name: '升級' }).click();
  // 銅級鋤頭要 2000 金（設計的初版升級價）；玩家只有 100 金，應用層先檢查金幣。
  await expect(page.locator('#shop-list')).toContainText('2000 金');
  await expect(page.locator('#hud-log')).toContainText('金幣不夠');
  await expect(page.locator('#hud-gold')).toHaveText('100 金');
});
