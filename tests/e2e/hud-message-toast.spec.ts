import { expect, test, type Browser } from '@playwright/test';

const evidenceRoot = 'docs/art/candidates/pixel-movement/p5-hud-toast/screenshots';
const nodeProcess = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process;
const saveEvidence = nodeProcess?.env?.SAVE_P5_050_EVIDENCE === '1';

async function exerciseViewport(
  browser: Browser,
  viewport: { width: number; height: number; label: string },
): Promise<void> {
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width < 600,
    hasTouch: viewport.width < 600,
  });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await expect(page.locator('#game canvas')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');

    const toggle = page.locator('#hud-log-toggle');
    const toast = page.locator('#hud-toast');
    const log = page.locator('#hud-log');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(log).toBeHidden();
    const before = await page.locator('#game canvas').boundingBox();
    expect(before).not.toBeNull();

    await page.keyboard.press('x');
    await expect(toast).toBeVisible();
    const latest = await log.locator('li').last().innerText();
    await expect(toast).toHaveText(latest);
    if (saveEvidence) {
      const fs = await import('node:' + 'fs/promises');
      const path = await import('node:' + 'path');
      const root = path.resolve(nodeProcess?.cwd() ?? '.', evidenceRoot);
      await fs.mkdir(root, { recursive: true });
      await page.screenshot({ path: path.join(root, `${viewport.label}-collapsed.png`), animations: 'disabled' });
    }

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(log).toBeVisible();
    if (saveEvidence) {
      const fs = await import('node:' + 'fs/promises');
      const path = await import('node:' + 'path');
      const root = path.resolve(nodeProcess?.cwd() ?? '.', evidenceRoot);
      await page.screenshot({ path: path.join(root, `${viewport.label}-history.png`), animations: 'disabled' });
    }

    const afterExpand = await page.locator('#game canvas').boundingBox();
    expect(afterExpand).toEqual(before);
    await page.keyboard.press('x');
    await expect(toast).toBeVisible();
    await expect(log.locator('li').last()).toHaveText(await toast.innerText());
    const afterMessage = await page.locator('#game canvas').boundingBox();
    expect(afterMessage).toEqual(before);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(log).toBeHidden();
  } finally {
    await context.close();
  }
}

test('HUD message toast and expandable six-message history preserve desktop and mobile canvas geometry', async ({ browser }) => {
  test.setTimeout(60_000);
  await exerciseViewport(browser, { width: 1280, height: 720, label: 'desktop' });
  await exerciseViewport(browser, { width: 390, height: 844, label: 'mobile' });
});

test('the latest-message toast fades while the history remains available', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  const toast = page.locator('#hud-toast');
  const toggle = page.locator('#hud-log-toggle');
  const log = page.locator('#hud-log');
  await page.keyboard.press('x');
  await expect(toast).toBeVisible();
  await expect(toast).toBeHidden({ timeout: 7_000 });
  await toggle.click();
  await expect(log.locator('li')).toHaveCount(2);
  await expect(log.locator('li').last()).toContainText('沒有可以互動');
});
