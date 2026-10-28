import { expect, test, type Page } from '@playwright/test';

const viewports = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 812, height: 375 },
  { width: 844, height: 390 },
];

async function start(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
}

async function assertPanelFits(page: Page, width: number, height: number): Promise<void> {
  const measurement = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('#inventory-panel')!;
    const rect = panel.getBoundingClientRect();
    const content = document.querySelector<HTMLElement>('#inventory-content')!;
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: innerWidth,
      height: innerHeight,
      pageWidth: document.documentElement.scrollWidth,
      contentClient: content.clientHeight,
      contentScroll: content.scrollHeight,
    };
  });

  expect(measurement.width, `${width}×${height}: viewport width`).toBe(width);
  expect(measurement.height, `${width}×${height}: viewport height`).toBe(height);
  expect(measurement.left, `${width}×${height}: panel left safe bound`).toBeGreaterThanOrEqual(0);
  expect(measurement.top, `${width}×${height}: panel top safe bound`).toBeGreaterThanOrEqual(0);
  expect(measurement.right, `${width}×${height}: panel right safe bound`).toBeLessThanOrEqual(width + 1);
  expect(measurement.bottom, `${width}×${height}: panel bottom safe bound`).toBeLessThanOrEqual(height + 1);
  expect(measurement.pageWidth, `${width}×${height}: page has no horizontal overflow`).toBeLessThanOrEqual(width);
  expect(measurement.contentScroll, `${width}×${height}: inventory content can scroll`).toBeGreaterThan(measurement.contentClient);

  const targets = page.locator('#inventory-close, #inventory-panel .inventory-filters button, #inventory-grid button, #inventory-detail button');
  for (let index = 0; index < await targets.count(); index += 1) {
    const target = targets.nth(index);
    await expect.poll(async () => {
      const bounds = await target.boundingBox();
      return bounds === null ? 0 : Math.min(bounds.width, bounds.height);
    }, { message: `${width}×${height}: touch target ${index} reaches its 44px minimum after layout settles` })
      .toBeGreaterThanOrEqual(44);
    const bounds = await target.boundingBox();
    expect(bounds, `${width}×${height}: touch target ${index} bounds`).not.toBeNull();
    expect(bounds!.width, `${width}×${height}: touch target ${index} width`).toBeGreaterThanOrEqual(44);
    expect(bounds!.height, `${width}×${height}: touch target ${index} height`).toBeGreaterThanOrEqual(44);
  }
}

test.describe('VF-10 mobile inventory', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });

  test('opens the enlarged item image by touch without overflowing the phone panel', async ({ page }) => {
    await start(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#hud-inventory').tap();
    await page.locator('#inventory-grid [data-item-id="seed.sweet-radish"]').tap();

    const detail = page.locator('#inventory-detail');
    const toggle = detail.locator('.inventory-detail-icon');
    await toggle.scrollIntoViewIfNeeded();
    await toggle.tap();

    const preview = detail.locator('.inventory-detail-preview');
    await expect(preview).toBeVisible();
    await expect(preview.locator('img')).toHaveAttribute('alt', '甜蘿蔔種子放大預覽');
    await preview.scrollIntoViewIfNeeded();
    await expect(preview).toBeInViewport();
    await assertPanelFits(page, 390, 844);

    const dimensions = await preview.locator('img').evaluate((image) => {
      const rect = image.getBoundingClientRect();
      const card = image.closest('#inventory-detail')!.getBoundingClientRect();
      return { imageWidth: rect.width, imageRight: rect.right, cardRight: card.right };
    });
    expect(dimensions.imageWidth).toBeLessThanOrEqual(224);
    expect(dimensions.imageRight).toBeLessThanOrEqual(dimensions.cardRight + 1);
  });

  test('fits safe bounds, scrolls to details, and supports touch at portrait and landscape sizes', async ({ page }) => {
    await start(page);
    await page.locator('#hud-inventory').tap();
    await expect(page.locator('#inventory-panel')).toBeVisible();
    await page.locator('#inventory-grid [data-item-id="seed.moon-bean"]').tap();
    await expect(page.locator('#inventory-detail')).toHaveAttribute('data-state', 'selected');

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expect(page.locator('#inventory-panel')).toBeVisible();
      await page.locator('#inventory-grid [data-item-id="seed.moon-bean"]').tap();
      await expect(page.locator('#inventory-detail')).toHaveAttribute('data-item-id', 'seed.moon-bean');
      await assertPanelFits(page, viewport.width, viewport.height);
      await page.screenshot({ path: `test-results/vf10/inventory-${viewport.width}x${viewport.height}.png` });

      const content = page.locator('#inventory-content');
      await content.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      const detailsAction = page.locator('#inventory-detail button').first();
      await expect(detailsAction).toBeVisible();
      await detailsAction.scrollIntoViewIfNeeded();
      await expect(detailsAction).toBeInViewport();
      await expect(page.locator('#inventory-close')).toBeInViewport();

      await page.locator('#inventory-filter-food').tap();
      await expect(page.locator('#inventory-filter-food')).toHaveAttribute('aria-pressed', 'true');
      await page.locator('#inventory-filter-all').tap();
    }
  });

  test('keeps the modal usable through rotation and restores touch input after close', async ({ page }) => {
    await start(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const opener = page.locator('#hud-inventory');
    await opener.tap();
    await page.locator('#inventory-grid [data-item-id="seed.moon-bean"]').tap();

    const content = page.locator('#inventory-content');
    await content.evaluate((element) => { element.scrollTop = Math.min(48, element.scrollHeight); });
    const scrollBefore = await content.evaluate((element) => element.scrollTop);
    await page.setViewportSize({ width: 812, height: 375 });
    await expect(page.locator('#inventory-panel')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.responsiveLayout().orientation ?? '')).toBe('landscape');
    expect(await content.evaluate((element) => element.scrollTop)).toBe(scrollBefore);
    await assertPanelFits(page, 812, 375);

    await page.locator('#inventory-close').tap();
    await expect(page.locator('#inventory-panel')).toBeHidden();
    await expect(opener).toBeFocused();

    await page.evaluate(() => { document.body.dataset.lastTouchPointerType = ''; });
    await page.evaluate(() => document.querySelector('#hud-settings')!.addEventListener('pointerdown', (event) => {
      document.body.dataset.lastTouchPointerType = (event as PointerEvent).pointerType;
    }, { once: true, capture: true }));
    await page.locator('#hud-settings').tap();
    await expect.poll(() => page.locator('body').getAttribute('data-last-touch-pointer-type')).toBe('touch');
    await expect(page.locator('#settings-panel')).toBeVisible();
    await page.locator('#settings-close').tap();
    await expect(page.locator('#settings-panel')).toBeHidden();
  });
});
