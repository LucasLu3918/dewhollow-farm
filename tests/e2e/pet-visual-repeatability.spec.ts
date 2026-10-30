import { expect, test, type Browser, type Page } from '@playwright/test';

const VIEWPORT = { width: 1280, height: 720 };

async function preparePetScene(browser: Browser): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const random = Math.random;
    Math.random = () => {
      Math.random = random;
      return 0;
    };

    const addDesktopStageStyle = (): boolean => {
      if (!document.head) return false;
      const style = document.createElement('style');
      style.dataset.petRepeatabilityLayout = 'true';
      style.textContent = `
        @media (orientation: landscape) and (min-width: 601px) and (min-height: 521px) {
          .app {
            height: auto !important;
            grid-template-rows: auto auto auto !important;
          }
          .app .stage {
            width: 100% !important;
            height: auto !important;
            aspect-ratio: 4 / 3 !important;
          }
        }
      `;
      document.head.append(style);
      return true;
    };
    if (!addDesktopStageStyle()) {
      const observer = new MutationObserver(() => {
        if (addDesktopStageStyle()) observer.disconnect();
      });
      observer.observe(document, { childList: true, subtree: true });
    }
  });

  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect(page.locator('#hud-weather')).toContainText('晴');
  await expect.poll(async () => page.locator('#game canvas').evaluate((canvas) => {
    const { width, height } = canvas.getBoundingClientRect();
    return { width: Math.round(width), height: Math.round(height) };
  })).toEqual({ width: 926, height: 694 });

  const route = [
    ...Array.from({ length: 12 }, () => 'ArrowDown'),
    'ArrowLeft',
    'ArrowDown',
    'ArrowDown',
    'ArrowRight',
    'ArrowDown',
  ];
  for (const key of route) {
    const before = await page.evaluate(() => ({
      mapId: window.__dewhollow?.mapId(),
      player: window.__dewhollow?.actors().find((item) => item.id === 'player'),
    }));
    if (before.mapId === 'village') break;
    await page.keyboard.press(key);
    await expect.poll(() => page.evaluate(({ mapId, player }) => {
      const debug = window.__dewhollow;
      const current = debug?.actors().find((item) => item.id === 'player');
      return debug?.mapId() === 'village'
        || (current !== undefined && player !== undefined && (current.tileX !== player.tileX || current.tileY !== player.tileY));
    }, before)).toBe(true);
    await expect.poll(() => page.evaluate(() => (window.__dewhollow?.actors() ?? [])
      .filter((item) => item.id === 'player' || item.id === 'cat')
      .every((item) => !item.busy))).toBe(true);
  }
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('village');
  await expect.poll(() => page.evaluate(() => {
    const rest = { y: 0, rotation: 0, scaleX: 1, scaleY: 1, legA: 0, legB: 0, stretch: 0 };
    const actors = window.__dewhollow?.actors() ?? [];
    return ['player', 'cat', 'marsupial', 'maomao'].every((id) => {
      const item = actors.find((actor) => actor.id === id);
      return item !== undefined && !item.busy && JSON.stringify(item.pose) === JSON.stringify(rest);
    });
  })).toBe(true);

  const camera = await page.evaluate(() => new Promise<{ x: number; y: number }>((resolve, reject) => {
    const debug = window.__dewhollow;
    if (!debug) return reject(new Error('缺少 window.__dewhollow'));
    let previous = debug.cameraScroll();
    let stableFrames = 0;
    const deadline = performance.now() + 5_000;
    const sample = (): void => {
      const current = debug.cameraScroll();
      stableFrames = current.x === previous.x && current.y === previous.y ? stableFrames + 1 : 0;
      previous = current;
      if (stableFrames >= 5) resolve(current);
      else if (performance.now() >= deadline) reject(new Error('相機未在 5 秒內穩定'));
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  await page.evaluate(() => window.__dewhollow?.pauseScene());
  expect(await page.evaluate(() => window.__dewhollow?.cameraScroll())).toEqual(camera);
  return { page, close: () => context.close() };
}

async function captureRaster(page: Page, imagePath: string): Promise<{ width: number; height: number; sha256: string }> {
  await page.locator('#game canvas').screenshot({ path: imagePath, animations: 'disabled' });
  return page.evaluate(async () => {
    const dataUrl = await window.__dewhollow?.snapshot();
    if (!dataUrl) throw new Error('無法取得 Phaser canvas 快照');
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('無法建立像素讀取 canvas');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const digest = await crypto.subtle.digest('SHA-256', pixels);
    const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    return { width: canvas.width, height: canvas.height, sha256 };
  });
}

test('the approved pet village raster is pixel-identical across independent fresh sessions', async ({ browser }, testInfo) => {
  // This diagnostic opens two full game sessions; allow headroom when the complete E2E suite
  // is running beside another worker on slower CI hosts.
  test.setTimeout(60_000);

  const firstSession = await preparePetScene(browser);
  const firstImagePath = testInfo.outputPath('pet-village-repeatability-first.png');
  let firstRaster: { width: number; height: number; sha256: string };
  try {
    firstRaster = await captureRaster(firstSession.page, firstImagePath);
  } finally {
    await firstSession.close();
  }

  const secondSession = await preparePetScene(browser);
  const secondImagePath = testInfo.outputPath('pet-village-repeatability-second.png');
  let secondRaster: { width: number; height: number; sha256: string };
  try {
    secondRaster = await captureRaster(secondSession.page, secondImagePath);
  } finally {
    await secondSession.close();
  }

  await testInfo.attach('pet-village-repeatability.json', {
    body: JSON.stringify({ first: firstRaster, second: secondRaster }, null, 2),
    contentType: 'application/json',
  });
  console.info('[QA-008] pet village pixel hashes', JSON.stringify({ first: firstRaster, second: secondRaster }));
  if (firstRaster.width !== secondRaster.width || firstRaster.height !== secondRaster.height || firstRaster.sha256 !== secondRaster.sha256) {
    await testInfo.attach('pet-village-repeatability-first.png', { path: firstImagePath, contentType: 'image/png' });
    await testInfo.attach('pet-village-repeatability-second.png', { path: secondImagePath, contentType: 'image/png' });
  }
  expect(secondRaster, `兩個隔離的新 session 應輸出完全相同的寵物村莊像素；first=${JSON.stringify(firstRaster)}, second=${JSON.stringify(secondRaster)}`)
    .toEqual(firstRaster);
});
