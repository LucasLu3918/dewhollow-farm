import { expect, test, type Page } from '@playwright/test';

type PanelId = 'help-panel' | 'save-panel' | 'settings-panel';

async function start(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).not.toBe('');
}

async function openPanel(page: Page, panel: PanelId): Promise<{ opener: string; close: string }> {
  const actions: Record<PanelId, { opener: string; close: string }> = {
    'help-panel': { opener: '#hud-help', close: '#help-close' },
    'save-panel': { opener: '#hud-saves', close: '#save-close' },
    'settings-panel': { opener: '#hud-settings', close: '#settings-close' },
  };
  const action = actions[panel];
  await page.locator(action.opener).click();
  await expect(page.locator(`#${panel}`)).toBeVisible();
  return action;
}

async function assertPanelBounds(page: Page, panel: PanelId, viewport: { width: number; height: number }): Promise<void> {
  const bounds = await page.locator(`#${panel}`).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds.bottom).toBeLessThanOrEqual(viewport.height + 1);
}

for (const viewport of [
  { width: 1280, height: 720, label: 'desktop' },
  { width: 390, height: 600, label: 'mobile portrait' },
  { width: 844, height: 390, label: 'mobile landscape' },
]) {
  test.describe(`shared panel visuals: ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.width < 1000, isMobile: viewport.width < 600 });

    for (const panel of ['help-panel', 'save-panel', 'settings-panel'] as const) {
      test(`${panel} uses shared presentation primitives and keeps focus and close reachable`, async ({ page }) => {
        await start(page, viewport);
        const action = await openPanel(page, panel);
        const root = page.locator(`#${panel}`);

        await expect(root).toHaveClass(/ui-dialog-panel/);
        await expect(root.locator('header')).toHaveClass(/ui-dialog-panel__header/);
        await expect(root.locator('h2')).toHaveClass(/ui-dialog-panel__title/);
        await expect(root.locator(action.close)).toHaveClass(/ui-dialog-panel__close/);
        await expect(root).toHaveCSS('border-top-width', '4px');
        await expect(root.locator(':focus')).toHaveCount(1);
        await assertPanelBounds(page, panel, viewport);
        const closeBounds = await page.locator(action.close).boundingBox();
        expect(closeBounds?.height).toBeGreaterThanOrEqual(44);

        const initialScroll = await root.evaluate((element) => ({ top: element.scrollTop, height: element.scrollHeight, client: element.clientHeight }));
        if (panel === 'settings-panel') expect(initialScroll.height).toBeGreaterThan(initialScroll.client);
        if (initialScroll.height > initialScroll.client) {
          await root.evaluate((element) => { element.scrollTop = element.scrollHeight; });
          await expect(page.locator(action.close)).toBeInViewport();
        } else {
          await expect(page.locator(action.close)).toBeVisible();
        }

        await page.locator(action.close).click();
        await expect(root).toBeHidden();
        await expect(page.locator(action.opener)).toBeFocused();
      });
    }
  });
}

test('Help operation guide uses the shared tutorial section primitive', async ({ page }) => {
  await start(page, { width: 1280, height: 720 });
  await page.locator('#hud-help').click();
  await expect(page.locator('#help-body .ui-dialog-panel__section').first()).toContainText('操作按鍵');
  await expect(page.locator('#help-body .ui-dialog-panel__section-title').first()).toHaveText('操作按鍵');
});
