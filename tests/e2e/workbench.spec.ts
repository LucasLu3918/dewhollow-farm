import { expect, test, type Page } from '@playwright/test';

/** M4b：從小屋入口走到工作台前，確認未解鎖的合成配方會被拒絕。 */
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
  await walk(page, 'ArrowUp', 9); // (10,9)
  await walk(page, 'ArrowLeft', 7);
  await walk(page, 'ArrowDown', 7); // (3,16)，繞過工作台
  await walk(page, 'ArrowRight', 1); // (4,16)
  await walk(page, 'ArrowUp', 1); // 工作台在上方，擋住移動
  await page.keyboard.press('x');

  await expect(page.locator('#workbench-panel')).toBeVisible();
  await expect(page.locator('#workbench-list')).toContainText('灑水器');
  await expect(page.locator('#workbench-list')).toContainText('需要耕作 4 級');
  await page.locator('#workbench-list li', { hasText: '灑水器' }).getByRole('button', { name: '做' }).click();
  await expect(page.locator('#hud-log')).toContainText('還不會做這個');

  await page.keyboard.press('Escape');
  await expect(page.locator('#workbench-panel')).toBeHidden();
});
