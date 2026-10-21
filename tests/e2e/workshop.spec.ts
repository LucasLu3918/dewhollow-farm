import { expect, test, type Page } from '@playwright/test';

/**
 * M4（P1 之後）：加工機（醃漬、烘乾）。路線：農場出生點 (7,9) → 往上到 (7,5)，左到 (2,5)，進小屋的門 (2,4)，
 * 落在小屋 (4,5)；往上到 (4,2)，右到 (8,2)，面向上方的加工台 (8,1)。開面板後，沒有材料就放不進去。
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

test('the workshop opens a panel of recipes; without ingredients nothing goes into the machine', async ({ page }) => {
  await waitForGame(page);
  await walk(page, 'ArrowUp', 4);
  await walk(page, 'ArrowLeft', 5);
  await walk(page, 'ArrowUp', 1);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');
  await walk(page, 'ArrowUp', 3);
  await walk(page, 'ArrowRight', 4);
  await walk(page, 'ArrowUp', 1); // 加工台在上方；按上鍵只會轉向（加工台擋住）
  await page.keyboard.press('x');

  await expect(page.locator('#workshop-panel')).toBeVisible();
  await expect(page.locator('#workshop-funds')).toContainText('加工中：0 / 3 批');
  await expect(page.locator('#workshop-list')).toContainText('放：烘乾薄荷');
  await page.locator('#workshop-list li', { hasText: '放：烘乾薄荷' }).getByRole('button', { name: '放入' }).click();
  await expect(page.locator('#hud-log')).toContainText('材料不夠');
  await expect(page.locator('#workshop-funds')).toContainText('加工中：0 / 3 批');

  await page.keyboard.press('Escape');
  await expect(page.locator('#workshop-panel')).toBeHidden();
});
