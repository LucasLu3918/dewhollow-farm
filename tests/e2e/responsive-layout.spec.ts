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
    const actual = await page.evaluate(() => {
      const host = document.querySelector<HTMLElement>('#game');
      const canvas = host?.querySelector('canvas');
      const camera = window.__dewhollow?.cameraView();
      const pixelViewport = window.__dewhollow?.pixelViewport();
      const layout = window.__dewhollow?.responsiveLayout();
      if (!host || !canvas || !camera || !pixelViewport || !layout) return null;

      const hostBounds = host.getBoundingClientRect();
      const localRect = (element: Element | null): { x: number; y: number; width: number; height: number } | null => {
        if (!(element instanceof HTMLElement)) return null;
        const bounds = element.getBoundingClientRect();
        return { x: bounds.left - hostBounds.left, y: bounds.top - hostBounds.top, width: bounds.width, height: bounds.height };
      };
      const canvasRect = localRect(canvas);
      if (!canvasRect) return null;
      const scaleX = canvasRect.width / pixelViewport.renderResolution.width;
      const scaleY = canvasRect.height / pixelViewport.renderResolution.height;
      return {
        safeRect: layout.safeRect,
        controls: ['.touch-move', '.touch-act'].map((selector) => localRect(host.parentElement?.querySelector(selector) ?? null)),
        cameraViewport: {
          x: canvasRect.x + camera.x * scaleX,
          y: canvasRect.y + camera.y * scaleY,
          width: camera.width * camera.zoom * scaleX,
          height: camera.height * camera.zoom * scaleY,
        },
      };
    });
    expect(actual).not.toBeNull();
    const { safeRect, controls, cameraViewport } = actual!;
    const tolerance = 2; // #game has a 1px border around the Phaser canvas.
    for (const [dimension, actualValue, expectedValue] of [
      ['x', cameraViewport.x, safeRect.x],
      ['y', cameraViewport.y, safeRect.y],
      ['width', cameraViewport.width, safeRect.width],
      ['height', cameraViewport.height, safeRect.height],
    ] as const) {
      expect(Math.abs(actualValue - expectedValue), `actual Phaser viewport ${dimension} vs safeRect`).toBeLessThanOrEqual(tolerance);
    }
    expect(controls).toHaveLength(2);
    for (const [index, control] of controls.entries()) {
      expect(control, `rendered control group ${index}`).not.toBeNull();
      const overlapsCamera = control!.x < cameraViewport.x + cameraViewport.width &&
        control!.x + control!.width > cameraViewport.x &&
        control!.y < cameraViewport.y + cameraViewport.height &&
        control!.y + control!.height > cameraViewport.y;
      expect(overlapsCamera, `rendered control group ${index} intersects the actual camera viewport`).toBe(false);
    }
    await expect(page.locator('#settings-placement')).toHaveValue('overlay');
  });
});

test.describe('桌機短視窗版面', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('1280×720 的遊戲畫面、主要操作與回饋列都在首屏，不需垂直捲動', async ({ page }) => {
    await start(page);
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press('ArrowUp');
      await page.waitForFunction(() => window.__dewhollow?.actors().find((actor) => actor.id === 'player')?.busy === false);
    }

    const action = page.locator('#hud-action');
    await expect(action).toBeEnabled();
    await action.click();
    await expect(page.locator('#hud-log')).toContainText('開墾了一塊田');

    const layout = await page.evaluate(() => {
      const rect = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return null;
        const bounds = element.getBoundingClientRect();
        return { top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
      };
      return {
        viewport: { width: innerWidth, height: innerHeight },
        clientHeight: document.documentElement.clientHeight,
        scrollHeight: document.documentElement.scrollHeight,
        status: rect('.status'),
        action: rect('#hud-action'),
        stage: rect('#game'),
        canvas: rect('#game canvas'),
        log: rect('#hud-log'),
      };
    });

    expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight);
    for (const [name, box] of Object.entries({ status: layout.status, action: layout.action, stage: layout.stage, canvas: layout.canvas, log: layout.log })) {
      expect(box, `${name} is present`).not.toBeNull();
      expect(box!.top, `${name} top`).toBeGreaterThanOrEqual(0);
      expect(box!.right, `${name} right`).toBeLessThanOrEqual(layout.viewport.width + 1);
      expect(box!.bottom, `${name} bottom`).toBeLessThanOrEqual(layout.viewport.height + 1);
    }
    expect(Math.abs(layout.stage!.width / layout.stage!.height - 4 / 3)).toBeLessThan(0.02);
  });
});
