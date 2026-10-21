import { expect, test, type Page } from '@playwright/test';

/**
 * M4b：工作台（合成）。路線：農場出生點 (7,9) → 往上到 (7,5)，左到 (2,5)，進小屋的門 (2,4)，落在小屋 (4,5)；
 * 往上到 (4,2)，面向上方的工作台 (4,1)。新玩家的耕作等級是 0，灑水器要 4 級，所以面板會說明條件，按下去會被拒絕。
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

test('the workbench lists recipes with their unlock conditions; a locked recipe is refused', async ({ page }) => {
  await waitForGame(page);
  await walk(page, 'ArrowUp', 4);
  await walk(page, 'ArrowLeft', 5);
  await walk(page, 'ArrowUp', 1);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');
  await walk(page, 'ArrowUp', 3);
  await walk(page, 'ArrowUp', 1); // 工作台在上方；按上鍵只會轉向（工作台擋住）
  await page.keyboard.press('x');

  await expect(page.locator('#workbench-panel')).toBeVisible();
  await expect(page.locator('#workbench-list')).toContainText('灑水器');
  await expect(page.locator('#workbench-list')).toContainText('需要耕作 4 級');
  await page.locator('#workbench-list li', { hasText: '灑水器' }).getByRole('button', { name: '做' }).click();
  await expect(page.locator('#hud-log')).toContainText('還不會做這個');

  await page.keyboard.press('Escape');
  await expect(page.locator('#workbench-panel')).toBeHidden();
});
