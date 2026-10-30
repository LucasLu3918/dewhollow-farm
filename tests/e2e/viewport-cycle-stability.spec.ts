import { expect, test, type BrowserContext, type Page } from '@playwright/test';

type Rect = { x: number; y: number; width: number; height: number };
type ViewportSnapshot = {
  mapId: string;
  canvas: Rect;
  zoom: number;
  visibleTiles: { width: number; height: number };
  dpr: number;
  layout: {
    viewport: { width: number; height: number };
    scroll: { x: number; y: number };
    app: Rect;
    stage: Rect;
    host: Rect;
  };
};
type ResizeSample = { target: string; width: number; height: number; at: number };

declare global {
  interface Window {
    __viewportCycleTrace?: { resizeObserver: ResizeSample[] };
  }
}

const configurations = [
  { family: '桌面大視窗', width: 1920, height: 1080, dpr: 1 },
  { family: '桌面大視窗', width: 1920, height: 1080, dpr: 2 },
  { family: '桌面 4:3', width: 1280, height: 960, dpr: 1 },
  { family: '桌面窄視窗', width: 1280, height: 720, dpr: 1 },
  { family: '平板直向', width: 768, height: 1024, dpr: 2, isMobile: true, hasTouch: true },
  { family: '手機直向', width: 390, height: 844, dpr: 3, isMobile: true, hasTouch: true },
  { family: '手機橫向', width: 844, height: 390, dpr: 3, isMobile: true, hasTouch: true },
] as const;
const nodeProcess = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process;
const configuredCycles = Number(nodeProcess?.env?.['DEWHOLLOW_VIEWPORT_CYCLES'] ?? '10');
if (configuredCycles !== 10 && configuredCycles !== 100) {
  throw new Error('DEWHOLLOW_VIEWPORT_CYCLES must be either 10 (default smoke) or 100 (extended stress).');
}

async function instrumentResizeObserver(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const trace = { resizeObserver: [] as ResizeSample[] };
    window.__viewportCycleTrace = trace;
    const NativeResizeObserver = window.ResizeObserver;
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: class extends NativeResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          super((entries, observer) => {
            for (const entry of entries) {
              const target = entry.target as HTMLElement;
              if (target.id === 'game' || target.classList.contains('app')) {
                trace.resizeObserver.push({
                  target: target.id || 'app',
                  width: entry.contentRect.width,
                  height: entry.contentRect.height,
                  at: performance.now(),
                });
              }
            }
            callback(entries, observer);
          });
        }
      },
    });
  });
}

async function waitForFarm(page: Page): Promise<void> {
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function waitForMovementIdle(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    return movement && !movement.moving && !movement.pending && movement.queuedTaps === 0 && movement.heldDirection === null;
  })).toBe(true);
}

async function move(page: Page, key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'): Promise<void> {
  await page.keyboard.press(key);
  await waitForMovementIdle(page);
}

async function snapshot(page: Page): Promise<ViewportSnapshot> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
    const debug = window.__dewhollow;
    if (!canvas || !debug) throw new Error('畫布或 DEV viewport 診斷介面尚未就緒');
    const rect = canvas.getBoundingClientRect();
    const viewport = debug.pixelViewport();
    const rectOf = (selector: string): Rect => {
      const element = document.querySelector<HTMLElement>(selector);
      const bounds = element?.getBoundingClientRect();
      return bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : { x: -1, y: -1, width: -1, height: -1 };
    };
    return {
      mapId: debug.mapId(),
      canvas: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      zoom: debug.cameraView().zoom,
      visibleTiles: viewport.actualWorldTilesVisible,
      dpr: window.devicePixelRatio,
      layout: {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        scroll: { x: window.scrollX, y: window.scrollY },
        app: rectOf('.app'),
        stage: rectOf('.stage'),
        host: rectOf('#game'),
      },
    };
  });
}

function expectSameViewport(actual: ViewportSnapshot, expected: ViewportSnapshot): void {
  expect(actual.mapId).toBe(expected.mapId);
  expect(actual.dpr).toBe(expected.dpr);
  expect(Math.abs(actual.zoom - expected.zoom)).toBeLessThanOrEqual(1e-6);
  for (const dimension of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(actual.canvas[dimension] - expected.canvas[dimension]),
      `canvas ${dimension}; layout before=${JSON.stringify(expected.layout)} after=${JSON.stringify(actual.layout)}`)
      .toBeLessThanOrEqual(1);
  }
  expect(Math.abs(actual.visibleTiles.width - expected.visibleTiles.width)).toBeLessThanOrEqual(1e-6);
  expect(Math.abs(actual.visibleTiles.height - expected.visibleTiles.height)).toBeLessThanOrEqual(1e-6);
}

async function captureStableSnapshot(page: Page): Promise<ViewportSnapshot> {
  let previous: ViewportSnapshot | undefined;
  let consecutiveMatches = 0;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5_000) {
    const current = await snapshot(page);
    if (previous) {
      try {
        expectSameViewport(current, previous);
        consecutiveMatches += 1;
      } catch {
        consecutiveMatches = 0;
      }
    }
    if (consecutiveMatches >= 3) return current;
    previous = current;
    await page.waitForTimeout(50);
  }
  throw new Error('viewport 未能在 5 秒內收斂到連續三次相同的快照');
}

async function expectObserverSettleWindow(page: Page, quietMs = 300): Promise<void> {
  const settledCount = await page.evaluate(() => window.__viewportCycleTrace?.resizeObserver.length ?? 0);
  await page.waitForTimeout(quietMs);
  expect(await page.evaluate(() => window.__viewportCycleTrace?.resizeObserver.length ?? 0)).toBe(settledCount);
}

async function enterHouseFromSpawn(page: Page): Promise<void> {
  // 新農場 spawn 為 (20,14)；沿中央道路到小屋門 (27,9)。
  for (let step = 0; step < 7; step += 1) await move(page, 'ArrowRight');
  for (let step = 0; step < 5; step += 1) await move(page, 'ArrowUp');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');
}

async function returnToFarmFromHouse(page: Page): Promise<void> {
  await move(page, 'ArrowDown');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function reachShipbox(page: Page): Promise<void> {
  // 從房門回程落點 (27,10) 沿中央路繞到出貨箱西側 (19,27)。
  for (let step = 0; step < 7; step += 1) await move(page, 'ArrowLeft');
  for (let step = 0; step < 16; step += 1) await move(page, 'ArrowDown');
  await move(page, 'ArrowLeft');
  await move(page, 'ArrowDown');
}

async function returnFromShipboxToHouse(page: Page): Promise<void> {
  // 從出貨箱西側 (19,27) 經中央主路回到小屋門 (27,9)。
  await move(page, 'ArrowUp');
  await move(page, 'ArrowRight');
  for (let step = 0; step < 16; step += 1) await move(page, 'ArrowUp');
  for (let step = 0; step < 7; step += 1) await move(page, 'ArrowRight');
  await move(page, 'ArrowUp');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');
}

async function toggleSavePanel(page: Page): Promise<void> {
  await page.keyboard.press('l');
  await expect(page.locator('#save-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#save-panel')).toBeHidden();
}

test.describe('世界 viewport 矩陣與狀態循環穩定性', () => {
  for (const configuration of configurations) {
    test(`${configuration.family} ${configuration.width}×${configuration.height} DPR ${configuration.dpr} 的農場／小屋視野穩定`, async ({ browser }, testInfo) => {
      test.setTimeout(60_000);
      const context = await browser.newContext({
        viewport: { width: configuration.width, height: configuration.height },
        deviceScaleFactor: configuration.dpr,
        ...('isMobile' in configuration ? { isMobile: true, hasTouch: true } : {}),
      });
      try {
        await instrumentResizeObserver(context);
        const page = await context.newPage();
        await page.goto('/');
        await waitForFarm(page);
        const farm = await captureStableSnapshot(page);
        expect(farm.dpr).toBe(configuration.dpr);
        const resizedViewport = { width: configuration.width - 32, height: configuration.height - 24 };
        await page.setViewportSize(resizedViewport);
        await expect.poll(() => page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })))
          .toEqual(resizedViewport);
        const resizedFarm = await captureStableSnapshot(page);
        expect(resizedFarm.mapId).toBe('farm');
        expect(resizedFarm.dpr).toBe(configuration.dpr);
        expect(Math.abs(resizedFarm.canvas.width - farm.canvas.width)
          + Math.abs(resizedFarm.canvas.height - farm.canvas.height)).toBeGreaterThan(1);
        await expectObserverSettleWindow(page, 100);
        await page.setViewportSize({ width: configuration.width, height: configuration.height });
        await expect.poll(() => page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })))
          .toEqual({ width: configuration.width, height: configuration.height });
        const restoredFarm = await captureStableSnapshot(page);
        expectSameViewport(restoredFarm, farm);
        await expectObserverSettleWindow(page, 100);
        const screenshotFarm = await page.screenshot({ animations: 'disabled', scale: 'css' });
        await toggleSavePanel(page);
        const afterPanel = await captureStableSnapshot(page);
        expectSameViewport(afterPanel, farm);
        await page.keyboard.press('s');
        await expect(page.locator('#hud-log')).toContainText('已存檔');
        expectSameViewport(await captureStableSnapshot(page), farm);

        // 矩陣各設定都實際載入小屋並檢查 scene framing 與面板開關。
        await enterHouseFromSpawn(page);
        const house = await captureStableSnapshot(page);
        expect(house.mapId).toBe('house');
        const screenshotHouse = await page.screenshot({ animations: 'disabled', scale: 'css' });
        await toggleSavePanel(page);
        expectSameViewport(await captureStableSnapshot(page), house);
        await page.keyboard.press('s');
        await expect(page.locator('#hud-log')).toContainText('已存檔');
        expectSameViewport(await captureStableSnapshot(page), house);
        await returnToFarmFromHouse(page);
        await reachShipbox(page);
        expectSameViewport(await captureStableSnapshot(page), farm);

        await testInfo.attach(`${configuration.width}x${configuration.height}-dpr${configuration.dpr}-farm.png`, {
          body: screenshotFarm,
          contentType: 'image/png',
        });
        await testInfo.attach(`${configuration.width}x${configuration.height}-dpr${configuration.dpr}-house.png`, {
          body: screenshotHouse,
          contentType: 'image/png',
        });
        const observerSamples = await page.evaluate(() => window.__viewportCycleTrace?.resizeObserver ?? []);
        await testInfo.attach('viewport-matrix.json', {
          body: JSON.stringify({ configuration, farm, resizedFarm, restoredFarm, house, observerSamples }, null, 2),
          contentType: 'application/json',
        });
        // Finite convergence is checked above; no app/game resize may continue after settle.
        await expectObserverSettleWindow(page);
      } finally {
        await context.close();
      }
    });
  }

  test(`${configuredCycles}-cycle viewport stability across interaction, save, movement, house round trips and reload`, async ({ browser }, testInfo) => {
    test.setTimeout(configuredCycles === 100 ? 35 * 60 * 1_000 : 10 * 60 * 1_000);
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    try {
      await instrumentResizeObserver(context);
      const page = await context.newPage();
      await page.goto('/');
      await waitForFarm(page);

      // 先走進房間再回到 farm spawn (27,10)，每輪由出貨箱西側 (19,27) 開始及結束。
      await enterHouseFromSpawn(page);
      await move(page, 'ArrowDown');
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
      await reachShipbox(page);
      const baseline = await captureStableSnapshot(page);
      await move(page, 'ArrowRight'); // 面向箱子 (20,27)
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.interaction()?.action ?? '')).toBe('shipAll');
      await move(page, 'ArrowUp');
      await move(page, 'ArrowRight');
      for (let step = 0; step < 16; step += 1) await move(page, 'ArrowUp');
      for (let step = 0; step < 7; step += 1) await move(page, 'ArrowRight');
      await move(page, 'ArrowUp');
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');
      const houseBaseline = await captureStableSnapshot(page);
      await move(page, 'ArrowDown');
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
      await reachShipbox(page);
      expectSameViewport(await captureStableSnapshot(page), baseline);
      const measurements: Array<{ cycle: number; step: string; snapshot: ViewportSnapshot }> = [];

      const stressStartedAt = Date.now();
      for (let cycle = 1; cycle <= configuredCycles; cycle += 1) {
        // 面向出貨箱，再用真正的互動鍵執行 shipAll。
        await move(page, 'ArrowRight');
        const atShipbox = await captureStableSnapshot(page);
        expectSameViewport(atShipbox, baseline);
        measurements.push({ cycle, step: 'move-to-shipbox', snapshot: atShipbox });
        await expectObserverSettleWindow(page, 50);
        const interaction = await page.evaluate(() => window.__dewhollow?.interaction() ?? null);
        expect(interaction?.action).toBe('shipAll');
        await page.keyboard.press('x');
        await expect(page.locator('#hud-log')).toContainText('背包裡沒有可出貨的作物');
        const afterInteraction = await captureStableSnapshot(page);
        expectSameViewport(afterInteraction, baseline);
        measurements.push({ cycle, step: 'interact', snapshot: afterInteraction });
        await expectObserverSettleWindow(page, 50);

        await page.keyboard.press('l');
        await expect(page.locator('#save-panel')).toBeVisible();
        const panelOpen = await captureStableSnapshot(page);
        expectSameViewport(panelOpen, baseline);
        measurements.push({ cycle, step: 'save-panel-open', snapshot: panelOpen });
        await expectObserverSettleWindow(page, 50);
        await page.keyboard.press('Escape');
        await expect(page.locator('#save-panel')).toBeHidden();
        const panelClosed = await captureStableSnapshot(page);
        expectSameViewport(panelClosed, baseline);
        measurements.push({ cycle, step: 'save-panel-close', snapshot: panelClosed });
        await expectObserverSettleWindow(page, 50);
        await move(page, 'ArrowUp');
        const atDoor = await captureStableSnapshot(page);
        expectSameViewport(atDoor, baseline);
        measurements.push({ cycle, step: 'move-back-to-door', snapshot: atDoor });
        await expectObserverSettleWindow(page, 50);

        await move(page, 'ArrowRight');
        for (let step = 0; step < 16; step += 1) await move(page, 'ArrowUp');
        for (let step = 0; step < 7; step += 1) await move(page, 'ArrowRight');
        await move(page, 'ArrowUp');
        await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');
        const enteredHouse = await captureStableSnapshot(page);
        expectSameViewport(enteredHouse, houseBaseline);
        measurements.push({ cycle, step: 'enter-house', snapshot: enteredHouse });
        await expectObserverSettleWindow(page, 50);
        await move(page, 'ArrowDown');
        await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
        await reachShipbox(page);
        const leftHouse = await captureStableSnapshot(page);
        expectSameViewport(leftHouse, baseline);
        measurements.push({ cycle, step: 'leave-house', snapshot: leftHouse });
        await expectObserverSettleWindow(page, 50);

        await page.keyboard.press('s');
        await expect(page.locator('#hud-log')).toContainText('已存檔');
        const saved = await captureStableSnapshot(page);
        expectSameViewport(saved, baseline);
        measurements.push({ cycle, step: 'save', snapshot: saved });
        await expectObserverSettleWindow(page, 50);

        await page.reload();
        await waitForFarm(page);
        const afterReload = await captureStableSnapshot(page);
        expectSameViewport(afterReload, baseline);
        measurements.push({ cycle, step: 'reload', snapshot: afterReload });
        await expectObserverSettleWindow(page, 100);

        if (cycle % 10 === 0 || configuredCycles === 10) {
          const progress = {
            completedCycles: cycle,
            totalCycles: configuredCycles,
            measurementsCaptured: measurements.length,
            lastMeasurement: measurements[measurements.length - 1],
            elapsedMs: Date.now() - stressStartedAt,
          };
          await testInfo.attach(`viewport-cycle-progress-${cycle}.json`, {
            body: JSON.stringify(progress, null, 2),
            contentType: 'application/json',
          });
          console.log(`[viewport stress] cycle=${progress.completedCycles}/${progress.totalCycles} measurements=${progress.measurementsCaptured} elapsedMs=${progress.elapsedMs} lastStep=${progress.lastMeasurement?.step}`);
        }
      }

      expect(measurements).toHaveLength(configuredCycles * 9);
      await testInfo.attach(`viewport-${configuredCycles}-cycle-measurements.json`, {
        body: JSON.stringify({ viewport: { width: 1280, height: 720 }, dpr: 1, baseline, measurements }, null, 2),
        contentType: 'application/json',
      });
    } finally {
      await context.close();
    }
  });
});
