import { expect, test, type Page } from '@playwright/test';

/**
 * M4（P1）：雞舍。路線：農場出生點 (7,9) → 往右到 (34,9) → 往上到 (34,5) → 門 (34,4) 進雞舍，落在 (3,4)。
 * 雞舍的乾草槽在 (6,3)。一開始只有 100 金，買不起雞（300 金），所以這裡只驗證門、座位與乾草槽的規則。
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

test('the coop door leads inside, and the trough says there are no animals yet', async ({ page }) => {
  await waitForGame(page);
  await walk(page, 'ArrowRight', 27);
  await walk(page, 'ArrowUp', 4);
  await walk(page, 'ArrowUp', 1);
  await expect.poll(() => mapId(page)).toBe('coop');

  await walk(page, 'ArrowUp', 1);
  await walk(page, 'ArrowRight', 2);
  await walk(page, 'ArrowRight', 1);
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('雞舍裡還沒有動物');
  await expect(page.locator('#hud-gold')).toHaveText('100 金');
});
