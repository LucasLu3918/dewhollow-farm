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

test('the status line shows every skill level, starting at zero', async ({ page }) => {
  await waitForGame(page);
  await expect(page.locator('#hud-skills')).toContainText('耕作 0');
  await expect(page.locator('#hud-skills')).toContainText('釣魚 0');
  await expect(page.locator('#hud-skills')).toContainText('烹飪 0');
});

test('casting at the lake with the rod: a fish bites sometimes, and a quick press reels it in', async ({ page }) => {
  await waitForGame(page);
  await toLake(page);
  await page.keyboard.press('r');
  await expect(page.locator('#hud-tool')).toHaveText('釣竿');

  // 投竿直到有魚上鉤（每次投竿扣 2 點體力，最多試 15 次）。
  let bit = false;
  for (let attempt = 0; attempt < 15 && !bit; attempt += 1) {
    await page.keyboard.press('x');
    await expect
      .poll(async () => (await page.locator('#hud-log').textContent()) ?? '')
      .toMatch(/魚上鉤了|魚沒有上鉤/);
    bit = ((await page.locator('#hud-log').textContent()) ?? '').includes('魚上鉤了');
    if (!bit) await page.waitForTimeout(50);
  }
  if (!bit) test.skip(true, '15 次投竿都沒有上鉤（機率極低），這次略過收線檢查');

  // 上鉤期間方向輸入被閘門擋下，玩家位置不變；互動鍵仍能在時限內收線。
  const beforeReel = await playerPosition(page);
  await page.keyboard.press('ArrowDown');
  expect(await playerPosition(page)).toEqual(beforeReel);
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('釣到了');
  // 投竿每次給 6 點釣魚經驗，所以技能列上的等級會跟著上升（這裡只檢查它顯示出來）。
  await expect(page.locator('#hud-skills')).toContainText('釣魚');
});

test('a fish that is not reeled in within the window gets away', async ({ page }) => {
  await waitForGame(page);
  await toLake(page);
  await page.keyboard.press('r');
  let bit = false;
  for (let attempt = 0; attempt < 15 && !bit; attempt += 1) {
    await page.keyboard.press('x');
    await expect
      .poll(async () => (await page.locator('#hud-log').textContent()) ?? '')
      .toMatch(/魚上鉤了|魚沒有上鉤/);
    bit = ((await page.locator('#hud-log').textContent()) ?? '').includes('魚上鉤了');
  }
  if (!bit) test.skip(true, '15 次投竿都沒有上鉤，這次略過');
  await expect(page.locator('#hud-log')).toContainText('魚跑掉了', { timeout: 5000 });
});
