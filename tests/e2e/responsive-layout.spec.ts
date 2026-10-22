import { expect, test, type Page } from '@playwright/test';

const SETTINGS_KEY = 'dewhollow-farm.settings';

declare global {
  interface Window {
    __setPointerCoarse?(coarse: boolean): void;
  }
}

async function seed(page: Page, placement: 'external' | 'overlay', touchControls: 'auto' | 'on' = 'on'): Promise<void> {
  await page.addInitScript(({ key, controlsPlacement, touchControls }) => {
    window.localStorage.setItem(key, JSON.stringify({
      schemaVersion: 2,
      settings: { touchControls, mobile: { controlsPlacement } },
    }));
  }, { key: SETTINGS_KEY, controlsPlacement: placement, touchControls });
}

async function fakePointerCapabilities(page: Page, coarse: boolean, touchPoints: number): Promise<void> {
  await page.addInitScript(({ initialCoarse, points }) => {
    const nativeMatchMedia = window.matchMedia.bind(window);
    const coarseQuery = nativeMatchMedia('(pointer: coarse)');
    let currentCoarse = initialCoarse;
    Object.defineProperty(coarseQuery, 'matches', { configurable: true, get: () => currentCoarse });
    window.matchMedia = (query: string): MediaQueryList =>
      query === '(pointer: coarse)' ? coarseQuery : nativeMatchMedia(query);
    Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { configurable: true, get: () => points });
    window.__setPointerCoarse = (value: boolean): void => {
      currentCoarse = value;
      coarseQuery.dispatchEvent(new Event('change'));
    };
  }, { initialCoarse: coarse, points: touchPoints });
}

async function start(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

test.describe('響應式版面整合', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('auto shows controls on a hybrid device with touch points and a fine primary pointer', async ({ page }) => {
    await seed(page, 'external', 'auto');
    await fakePointerCapabilities(page, false, 2);
    await start(page);
    await expect(page.locator('#touch-controls')).toBeVisible();
  });

  test('auto visibility follows pointer media-query changes without changing settings', async ({ page }) => {
    await seed(page, 'external', 'auto');
    await fakePointerCapabilities(page, false, 0);
    await start(page);
    const pad = page.locator('#touch-controls');
    await expect(pad).toBeHidden();
    await page.evaluate(() => window.__setPointerCoarse?.(true));
    await expect(pad).toBeVisible();
    await page.evaluate(() => window.__setPointerCoarse?.(false));
    await expect(pad).toBeHidden();
  });

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
    const safeRect = layout?.safeRect;
    const controlRect = layout?.controlsRects[0];
    expect(safeRect && controlRect).toBeTruthy();
    const overlaps = safeRect && controlRect &&
      safeRect.x < controlRect.x + controlRect.width && safeRect.x + safeRect.width > controlRect.x &&
      safeRect.y < controlRect.y + controlRect.height && safeRect.y + safeRect.height > controlRect.y;
    expect(overlaps).toBe(false);
    const camera = await page.evaluate(() => ({
      top: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--responsive-camera-y')),
      height: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--responsive-camera-height')),
    }));
    expect(camera.top).toBeCloseTo(safeRect?.y ?? 0, 1);
    expect(camera.height).toBeCloseTo(safeRect?.height ?? 0, 1);
    await expect(page.locator('#settings-placement')).toHaveValue('overlay');
  });
});
