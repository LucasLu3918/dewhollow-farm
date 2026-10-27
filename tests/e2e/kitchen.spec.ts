import { expect, test, type Page } from '@playwright/test';

/** M4（P1）：從小屋入口走到廚房前，驗證無材料時料理會被拒絕。 */
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
  await walk(page, 'ArrowUp', 9); // (10,9)
  await walk(page, 'ArrowRight', 8); // (18,9)
  await walk(page, 'ArrowUp', 2); // (18,7)
  await walk(page, 'ArrowUp', 1); // 廚房在前方，擋住移動
  await page.keyboard.press('x');

  await expect(page.locator('#kitchen-panel')).toBeVisible();
  await expect(page.locator('#kitchen-list')).toContainText('做：薄荷茶');
  await page.locator('#kitchen-list li', { hasText: '做：薄荷茶' }).getByRole('button', { name: '做' }).click();
  await expect(page.locator('#hud-log')).toContainText('材料不夠');

  await page.keyboard.press('Escape');
  await expect(page.locator('#kitchen-panel')).toBeHidden();
});
