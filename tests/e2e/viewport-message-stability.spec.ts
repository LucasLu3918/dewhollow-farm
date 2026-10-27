import { expect, test, type Page } from '@playwright/test';

interface ViewportTrace {
  startedAt: number;
  resizeObserver: Array<{
    sinceActionStartedMs: number;
    target: string;
    width: number;
    height: number;
    bounds: { x: number; y: number; width: number; height: number };
  }>;
  layoutPublish: Array<{ sinceActionStartedMs: number; property: string; value: string }>;
  clear(): void;
}

declare global {
  interface Window {
    __viewportTrace?: ViewportTrace;
  }
}

async function installViewportTrace(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const trace: ViewportTrace = {
      resizeObserver: [],
      layoutPublish: [],
      clear() {
        this.resizeObserver.length = 0;
        this.layoutPublish.length = 0;
        this.startedAt = performance.now();
      },
      startedAt: performance.now(),
    };
    window.__viewportTrace = trace;

    const NativeResizeObserver = window.ResizeObserver;
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: class extends NativeResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          super((entries, observer) => {
            const startedAt = window.__viewportTrace!.startedAt;
            for (const entry of entries) {
              const target = entry.target;
              if (target.id === 'game' || target.classList.contains('app')) {
                const bounds = target.getBoundingClientRect();
                trace.resizeObserver.push({
                  sinceActionStartedMs: performance.now() - startedAt,
                  target: target.id || target.getAttribute('class') || target.tagName.toLowerCase(),
                  width: entry.contentRect.width,
                  height: entry.contentRect.height,
                  bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
                });
              }
            }
            callback(entries, observer);
          });
        }
      },
    });

    const nativeSetProperty = CSSStyleDeclaration.prototype.setProperty;
    CSSStyleDeclaration.prototype.setProperty = function (property, value, priority): void {
      nativeSetProperty.call(this, property, value, priority);
      if (this === document.documentElement.style && property.startsWith('--responsive-')) {
        const startedAt = window.__viewportTrace!.startedAt;
        trace.layoutPublish.push({ sinceActionStartedMs: performance.now() - startedAt, property, value: value ?? '' });
      }
    };
  });
}

async function viewportSnapshot(page: Page) {
  return page.evaluate(() => {
    const app = document.querySelector<HTMLElement>('.app');
    const stage = document.querySelector<HTMLElement>('#game');
    const canvas = stage?.querySelector<HTMLCanvasElement>('canvas');
    const debug = window.__dewhollow;
    if (!app || !stage || !canvas || !debug) throw new Error('遊戲畫布或開發模式診斷介面尚未就緒');
    const rect = (element: Element) => {
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    };
    const responsive = debug.responsiveLayout();
    const rootStyle = document.documentElement.style;
    const inlineTokens = Object.fromEntries(Array.from({ length: rootStyle.length }, (_, index) => rootStyle.item(index))
      .filter((property) => property.startsWith('--responsive-'))
      .map((property) => [property, rootStyle.getPropertyValue(property)]));
    return {
      capturedAt: performance.now(),
      mapId: debug.mapId(),
      app: rect(app),
      stage: rect(stage),
      host: rect(stage),
      canvas: rect(canvas),
      canvasStyle: { width: getComputedStyle(canvas).width, height: getComputedStyle(canvas).height },
      buffer: { width: canvas.width, height: canvas.height },
      camera: debug.cameraView(),
      responsive: {
        orientation: responsive.orientation,
        worldRect: responsive.worldRect,
        safeRect: responsive.safeRect,
        cssTokens: responsive.cssTokens,
        inlineTokens,
      },
    };
  });
}

async function waitForTwoFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function waitForMovementIdle(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    return movement && !movement.moving && !movement.pending && movement.queuedTaps === 0 && movement.heldDirection === null;
  })).toBe(true);
}

async function enterHouse(page: Page): Promise<void> {
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft']) {
    await page.keyboard.press(key);
    await waitForMovementIdle(page);
  }
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');
}

async function walkToShipBox(page: Page): Promise<void> {
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft']) {
    await page.keyboard.press(key);
    await waitForMovementIdle(page);
  }
  await page.keyboard.press('ArrowLeft'); // Stand at (3,7), facing the shipbox at (2,7).
  await waitForMovementIdle(page);
}

async function walkToBed(page: Page): Promise<void> {
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ArrowUp']) {
    await page.keyboard.press(key);
    await waitForMovementIdle(page);
  }
  await page.keyboard.press('ArrowLeft'); // Stand at (2,1), facing the bed at (1,1).
  await waitForMovementIdle(page);
}

test.describe('訊息不應改變世界畫布尺寸', () => {
  test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

  for (const scene of [
    { id: 'farm', name: '農場' },
    { id: 'house', name: '小屋', enter: enterHouse },
  ]) {
    for (const action of [
      { name: '手動存檔', key: 's', message: '已存檔', target: null },
      {
        name: '互動', key: 'x', message: scene.id === 'house' ? '你睡了一覺' : '背包裡沒有可出貨的作物',
        target: scene.id === 'house'
          ? { action: 'sleep', tile: { x: 1, y: 1 } }
          : { action: 'shipAll', tile: { x: 2, y: 7 } },
      },
    ]) {
      test(`${scene.name} ${action.name} 前後記錄 CSS、Phaser 與 layout 發布`, async ({ page }, testInfo) => {
        await installViewportTrace(page);
        await page.goto('/');
        await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
        await expect(page.locator('#game canvas')).toBeVisible();
        if (scene.enter) await scene.enter(page);
        if (scene.id === 'house') await walkToBed(page);
        else if (action.target) await walkToShipBox(page);
        const initialLog = await page.locator('#hud-log').innerText();
        const mapBefore = await page.evaluate(() => window.__dewhollow!.mapId());
        const before = await viewportSnapshot(page);
        await page.screenshot({ path: testInfo.outputPath('before.png') });

        let dayBefore: number | null = null;
        if (action.target) {
          const targetState = await page.evaluate(() => ({
            interaction: window.__dewhollow!.interaction(),
            marker: window.__dewhollow!.interactionTargetMarker(),
            day: window.__dewhollow!.gameState().calendar.day,
          }));
          expect(targetState.interaction?.action).toBe(action.target.action);
          expect(targetState.interaction?.target).toEqual(action.target.tile);
          expect(targetState.marker).toMatchObject({ visible: true, target: action.target.tile });
          if (action.target.action === 'sleep') dayBefore = targetState.day;
        }

        const actionStartedAt = await page.evaluate(() => {
          window.__viewportTrace!.clear();
          return window.__viewportTrace!.startedAt;
        });
        await page.keyboard.press(action.key);
        await expect(page.locator('#hud-log')).toContainText(action.message);
        let dayAfter: number | null = null;
        if (dayBefore !== null) {
          dayAfter = await page.evaluate(() => window.__dewhollow!.gameState().calendar.day);
          expect(dayAfter).toBe(dayBefore + 1);
          await expect(page.locator('#hud-day')).toContainText(`第 ${dayAfter} 天`);
        }
        await waitForTwoFrames(page);
        const afterFrames = await viewportSnapshot(page);
        await page.waitForTimeout(500);
        const afterSettled = await viewportSnapshot(page);
        await page.screenshot({ path: testInfo.outputPath('after.png') });
        const events = await page.evaluate(() => ({
          actionStartedAt: window.__viewportTrace!.startedAt,
          resizeObserver: window.__viewportTrace?.resizeObserver ?? [],
          layoutPublish: window.__viewportTrace?.layoutPublish ?? [],
        }));
        const mapAfter = await page.evaluate(() => window.__dewhollow!.mapId());
        await testInfo.attach('viewport-snapshots', {
          body: JSON.stringify({ scene: scene.id, action: action.name, mapBefore, mapAfter, dayBefore, dayAfter, before, actionStartedAt, afterFrames, afterSettled, events }, null, 2),
          contentType: 'application/json',
        });

        expect(mapAfter).toBe(mapBefore);
        for (const actual of [afterFrames, afterSettled]) {
          expect(actual.buffer).toEqual(before.buffer);
          expect(actual.camera.zoom).toBeCloseTo(before.camera.zoom, 3);
          expect(actual.canvas.width).toBeCloseTo(before.canvas.width, 1);
          expect(actual.canvas.height).toBeCloseTo(before.canvas.height, 1);
          for (const role of ['app', 'stage', 'host'] as const) {
            for (const dimension of ['x', 'y', 'width', 'height'] as const) {
              expect(actual[role][dimension]).toBeCloseTo(before[role][dimension], 1);
            }
          }
        }
        const changedObservedSizes = events.resizeObserver.filter((event) => {
          const baseline = event.target === 'app' ? before.app : before.host;
          return Math.abs(event.bounds.width - baseline.width) > 0.1 || Math.abs(event.bounds.height - baseline.height) > 0.1;
        });
        expect(changedObservedSizes).toEqual([]);
        const changedResponsiveTokens = events.layoutPublish.filter(({ property, value }) => before.responsive.inlineTokens[property] !== value);
        expect(changedResponsiveTokens).toEqual([]);
      });
    }
  }
});

test('訊息歷史可用鍵盤捲動而不移動玩家，且新訊息保留閱讀位置', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('x');
  const log = page.locator('#hud-log');
  await expect.poll(() => log.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await log.focus();
  const playerBefore = await page.evaluate(() => window.__dewhollow!.movement().tile);
  await page.keyboard.press('Home');
  await expect.poll(() => log.evaluate((element) => element.scrollTop)).toBe(0);
  expect(await page.evaluate(() => window.__dewhollow!.movement().tile)).toEqual(playerBefore);
  await page.keyboard.press('PageDown');
  await expect.poll(() => log.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__dewhollow!.movement().tile)).toEqual(playerBefore);
  await page.keyboard.press('Tab');
  await expect(log).not.toBeFocused();
});

test('訊息區有焦點時，移動鍵與遊戲快捷鍵不觸發遊戲', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await page.keyboard.press('o');
  await page.locator('#settings-keys button[data-action="moveUp"]').click();
  await page.keyboard.press('u');
  await expect(page.locator('#settings-keys li', { hasText: '上移' }).locator('kbd')).toHaveText('U');
  await page.keyboard.press('Escape');

  const log = page.locator('#hud-log');
  await log.focus();
  const before = await page.evaluate(() => ({
    tile: window.__dewhollow!.movement().tile,
    state: window.__dewhollow!.gameState(),
    text: document.querySelector('#hud-log')!.textContent,
  }));
  for (const key of ['ArrowLeft', 'ArrowRight', 'u', 'x', 's']) await page.keyboard.press(key);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__dewhollow!.movement().tile)).toEqual(before.tile);
  expect(await page.evaluate(() => window.__dewhollow!.gameState())).toEqual(before.state);
  expect(await log.textContent()).toBe(before.text);
});

test('訊息達上限時淘汰首則，保留閱讀項目的畫面位置', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('m');
  const log = page.locator('#hud-log');
  await expect(log.locator('li')).toHaveCount(6);
  const position = await log.evaluate((element) => {
    const container = element as HTMLElement;
    const retained = element.children[2] as HTMLElement;
    retained.dataset.scrollAnchorTest = 'retained';
    element.scrollTop = retained.offsetTop - container.offsetTop - 10;
    return retained.getBoundingClientRect().top - element.getBoundingClientRect().top;
  });
  const previousLast = await log.locator('li').last().innerText();
  await page.keyboard.press('m');
  await expect.poll(() => log.locator('li').last().innerText()).not.toBe(previousLast);
  await expect(log.locator('li')).toHaveCount(6);
  const retained = log.locator('[data-scroll-anchor-test="retained"]');
  await expect(retained).toHaveCount(1);
  const after = await retained.evaluate((element) =>
    element.getBoundingClientRect().top - element.parentElement!.getBoundingClientRect().top);
  expect(after).toBeCloseTo(position, 0);
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test.describe(`${viewport.width}×${viewport.height} viewport`, () => {
    if (viewport.width < 1000) test.use({ hasTouch: true, isMobile: true });
  for (const font of ['預設', '特大']) {
    test(`${viewport.width}×${viewport.height} ${font}字級的長訊息不改變畫布尺寸`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
      if (viewport.width < 1000) {
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
        await expect(page.locator('#touch-controls')).toBeVisible();
      }
      if (font === '特大') {
        await page.keyboard.press('o');
        await page.locator('#settings-font button', { hasText: /^特大$/ }).click();
        await page.keyboard.press('Escape');
      }
      const before = await viewportSnapshot(page);
      const log = page.locator('#hud-log');
      await log.evaluate((element) => {
        const item = document.createElement('li');
        item.textContent = '很長的訊息需要完整換行並且可以捲動閱讀。'.repeat(20);
        element.append(item);
      });
      await waitForTwoFrames(page);
      const after = await viewportSnapshot(page);
      expect(after.canvas.width).toBeCloseTo(before.canvas.width, 1);
      expect(after.canvas.height).toBeCloseTo(before.canvas.height, 1);
      expect(after.buffer).toEqual(before.buffer);
      expect(after.camera.zoom).toBeCloseTo(before.camera.zoom, 3);
      const geometry = await log.evaluate((element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      }));
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
      expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);
    });
  }
  });
}
