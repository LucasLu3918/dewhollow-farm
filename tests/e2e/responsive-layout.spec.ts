import { expect, test, type Page } from '@playwright/test';

const SETTINGS_KEY = 'dewhollow-farm.settings';

async function seed(page: Page, placement: 'external' | 'overlay'): Promise<void> {
  await page.addInitScript(({ key, controlsPlacement }) => {
    window.localStorage.setItem(key, JSON.stringify({
      schemaVersion: 2,
      settings: { touchControls: 'on', mobile: { controlsPlacement } },
    }));
  }, { key: SETTINGS_KEY, controlsPlacement: placement });
}

async function start(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

test.describe('響應式版面整合', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('轉向十次時不重建世界、不改遊戲狀態，開啟面板和文字輸入也維持穩定', async ({ page }) => {
    await seed(page, 'external');
    await start(page);
    await page.keyboard.press('o');
    await expect(page.locator('#settings-panel')).toBeVisible();
    await page.locator('#settings-panel').evaluate((panel) => {
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('aria-label', '測試文字輸入');
      panel.append(input);
      input.focus();
    });
    const before = await page.evaluate(() => ({
      generation: window.__dewhollow?.worldGeneration(),
      map: window.__dewhollow?.mapId(),
      player: (() => {
        const player = window.__dewhollow?.actors().find((actor) => actor.id === 'player');
        return player ? { tileX: player.tileX, tileY: player.tileY } : null;
      })(),
    }));
    const canvas = await page.locator('#game canvas').elementHandle();
    for (let i = 0; i < 10; i += 1) {
      await page.setViewportSize(i % 2 === 0 ? { width: 844, height: 390 } : { width: 390, height: 844 });
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.responsiveLayout().orientation ?? '')).toBe(i % 2 === 0 ? 'landscape' : 'portrait');
      await expect(page.locator('#settings-panel')).toBeVisible();
      await expect(page.getByLabel('測試文字輸入')).toBeFocused();
    }
    const after = await page.evaluate(() => ({
      generation: window.__dewhollow?.worldGeneration(),
      map: window.__dewhollow?.mapId(),
      player: (() => {
        const player = window.__dewhollow?.actors().find((actor) => actor.id === 'player');
        return player ? { tileX: player.tileX, tileY: player.tileY } : null;
      })(),
    }));
    expect(await canvas?.evaluate((element) => element.isConnected)).toBe(true);
    expect(after).toEqual(before);
  });

  test('外置與覆蓋版位共享安全區，覆蓋時 controls 不擴張 camera 可視範圍', async ({ page }) => {
    await seed(page, 'external');
    await start(page);
    const externalStage = await page.locator('#game').boundingBox();
    const externalPad = await page.locator('#touch-controls').boundingBox();
    expect(externalStage && externalPad && externalPad.y >= externalStage.y + externalStage.height).toBe(true);
    await page.keyboard.press('o');
    await page.locator('#settings-placement').selectOption('overlay');
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.responsiveLayout().controlsRects.length ?? 0)).toBe(1);
    const overlayStage = await page.locator('#game').boundingBox();
    const overlayPad = await page.locator('#touch-controls').boundingBox();
    expect(overlayStage && overlayPad && overlayPad.y < overlayStage.y + overlayStage.height).toBe(true);
    const layout = await page.evaluate(() => window.__dewhollow?.responsiveLayout());
    expect(layout?.safeRect.height).toBeLessThan(layout?.worldRect.height ?? 0);
    await expect(page.locator('#settings-placement')).toHaveValue('overlay');
  });
});
