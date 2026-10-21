import { expect, test, type Page } from '@playwright/test';

/**
 * M4（P1）：料理。路線：農場出生點 (7,9) → 往上到 (7,5)，左到 (2,5)，進小屋的門 (2,4)，落在小屋 (4,5)；
 * 往上到 (4,2)，右到 (7,2)，面向上方的廚房 (7,1)。開廚房的面板後，沒有材料就做不成菜。
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

test('the kitchen opens a panel of recipes; without ingredients a dish cannot be made', async ({ page }) => {
  await waitForGame(page);
  await walk(page, 'ArrowUp', 4);
  await walk(page, 'ArrowLeft', 5);
  await walk(page, 'ArrowUp', 1);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');
  await walk(page, 'ArrowUp', 3);
  await walk(page, 'ArrowRight', 3);
  await walk(page, 'ArrowUp', 1); // 廚房在上方；按上鍵只會轉向（廚房擋住）
  await page.keyboard.press('x');

  await expect(page.locator('#kitchen-panel')).toBeVisible();
  await expect(page.locator('#kitchen-list')).toContainText('做：薄荷茶');
  await page.locator('#kitchen-list li', { hasText: '做：薄荷茶' }).getByRole('button', { name: '做' }).click();
  await expect(page.locator('#hud-log')).toContainText('材料不夠');

  await page.keyboard.press('Escape');
  await expect(page.locator('#kitchen-panel')).toBeHidden();
});
