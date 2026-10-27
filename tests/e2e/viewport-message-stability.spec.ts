import { expect, test, type Page } from '@playwright/test';

async function viewportSnapshot(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
    const debug = window.__dewhollow;
    if (!canvas || !debug) throw new Error('遊戲畫布或開發模式診斷介面尚未就緒');
    const rect = canvas.getBoundingClientRect();
    return {
      css: { width: rect.width, height: rect.height },
      buffer: { width: canvas.width, height: canvas.height },
      zoom: debug.cameraView().zoom,
    };
  });
}

async function waitForTwoFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

test.describe('訊息不應改變世界畫布尺寸', () => {
  test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

  for (const action of [
    { name: '手動存檔', key: 's', message: '已存檔' },
    { name: '互動', key: 'x', message: null },
  ]) {
    test(`${action.name}後畫布尺寸與鏡頭縮放維持不變`, async ({ page }, testInfo) => {
      await page.goto('/');
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
      await expect(page.locator('#game canvas')).toBeVisible();
      const initialLog = await page.locator('#hud-log').innerText();
      const before = await viewportSnapshot(page);
      await page.screenshot({ path: testInfo.outputPath('before.png') });

      await page.keyboard.press(action.key);
      if (action.message) {
        await expect(page.locator('#hud-log')).toContainText(action.message);
      } else {
        await expect.poll(() => page.locator('#hud-log').innerText()).not.toBe(initialLog);
      }
      await waitForTwoFrames(page);
      const afterFrames = await viewportSnapshot(page);
      await page.waitForTimeout(500);
      const afterSettled = await viewportSnapshot(page);
      await page.screenshot({ path: testInfo.outputPath('after.png') });
      await testInfo.attach('viewport-snapshots', {
        body: JSON.stringify({ before, afterFrames, afterSettled }, null, 2),
        contentType: 'application/json',
      });

      for (const actual of [afterFrames, afterSettled]) {
        expect(actual.buffer).toEqual(before.buffer);
        expect(actual.zoom).toBeCloseTo(before.zoom, 3);
        expect(actual.css.width).toBeCloseTo(before.css.width, 1);
        expect(actual.css.height).toBeCloseTo(before.css.height, 1);
      }
    });
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
      expect(after.css.width).toBeCloseTo(before.css.width, 1);
      expect(after.css.height).toBeCloseTo(before.css.height, 1);
      expect(after.buffer).toEqual(before.buffer);
      expect(after.zoom).toBeCloseTo(before.zoom, 3);
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
