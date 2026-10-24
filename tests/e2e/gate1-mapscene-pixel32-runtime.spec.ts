import { expect, test, type Browser } from '@playwright/test';

const candidateQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation';
const candidateRoot = '/docs/art/candidates/pixel-movement/gate1-assets';
const candidatePaths = [
  `${candidateRoot}/pixel32-map/manifest.json`,
  `${candidateRoot}/pixel32-map/map-atlas.png`,
  `${candidateRoot}/pixel32-animation/manifest.json`,
  `${candidateRoot}/pixel32-animation/player-4dir.png`,
];

async function startCandidateFarm(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const requests: string[] = [];
  page.on('request', (request) => {
    if (candidatePaths.some((path) => request.url().includes(path))) requests.push(new URL(request.url()).pathname);
  });
  await page.addInitScript(() => {
    const original = Math.random;
    let first = true;
    Math.random = () => {
      if (first) {
        first = false;
        Math.random = original;
        return 0;
      }
      return original();
    };
  });
  await page.goto(candidateQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  return { context, page, requests };
}

async function waitForMovementIdle(page: import('@playwright/test').Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    return movement !== undefined && !movement.moving && !movement.pending;
  })).toBe(true);
}

test('pixel32 map and player animation candidates run in the same DEV MapScene', async ({ browser }, testInfo) => {
  const { context, page, requests } = await startCandidateFarm(browser);
  // Boot assets may finish before the listener; diagnostics confirm both atlases and frames are registered.
  const initial = await page.evaluate(() => {
    const candidate = window.__dewhollow?.pixel32CandidateRuntime();
    const sprites = window.__dewhollow?.sprites() ?? [];
    return {
      candidate,
      mapSprites: sprites.filter((sprite) => sprite.key === 'gate1-pixel32-map-atlas').map((sprite) => sprite.frame),
      movement: window.__dewhollow?.movement(),
    };
  });
  expect(initial.candidate?.enabled).toBe(true);
  expect(initial.candidate?.mapFrames).toContain('spring-grass');
  expect(initial.candidate?.mapFrames).toContain('spring-field-edge-f');
  expect(initial.candidate?.animationFrames).toContain('left-contact-a');
  expect(initial.candidate?.playerFrame).toBe('down-idle');
  expect(requests).toEqual(expect.arrayContaining(candidatePaths));
  expect(initial.mapSprites).toContain('spring-grass');
  expect(initial.mapSprites.some((frame) => frame?.startsWith('spring-field-edge-'))).toBe(true);
  expect(initial.movement?.tile.x).toBeGreaterThanOrEqual(0);
  expect(initial.movement?.tile.y).toBeGreaterThanOrEqual(0);

  const screenshot = await page.screenshot({ animations: 'disabled', scale: 'css' });
  await testInfo.attach('pixel32-mapscene-candidate-1280x720.png', { body: screenshot, contentType: 'image/png' });

  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().playerFrame ?? '')).toMatch(/right-(contact-a|passing|contact-b)/);
  await page.waitForFunction((startX) => (window.__dewhollow?.movement().tile.x ?? startX) >= startX + 1, initial.movement!.tile.x, { timeout: 10_000 });
  await page.keyboard.up('ArrowRight');
  await waitForMovementIdle(page);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().playerFrame ?? '')).toBe('right-idle');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');

  // Exercise the other directions in the same grid runtime, then use the normal hoe command on (7, 4).
  await page.keyboard.down('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().playerFrame ?? '')).toMatch(/left-(contact-a|passing|contact-b)/);
  await page.keyboard.up('ArrowLeft');
  await waitForMovementIdle(page);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().tile.x ?? -1)).toBe(initial.movement!.tile.x);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().playerFrame ?? '')).toBe('left-idle');
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().playerFrame ?? '')).toMatch(/up-(contact-a|passing|contact-b)/);
  await page.keyboard.up('ArrowUp');
  await waitForMovementIdle(page);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().tile.y ?? -1)).toBe(initial.movement!.tile.y - 1);
  for (let step = 1; step < 4; step += 1) {
    const beforeY = await page.evaluate(() => window.__dewhollow?.movement().tile.y ?? -1);
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().tile.y ?? -1)).toBe(beforeY - 1);
    await waitForMovementIdle(page);
  }
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().playerFrame ?? '')).toBe('up-idle');
  await page.keyboard.down('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().playerFrame ?? '')).toMatch(/down-(contact-a|passing|contact-b)/);
  await page.keyboard.up('ArrowDown');
  await waitForMovementIdle(page);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().tile.y ?? -1)).toBe(initial.movement!.tile.y - 3);
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().playerFrame ?? '')).toMatch(/up-(contact-a|passing|contact-b)/);
  await page.keyboard.up('ArrowUp');
  await waitForMovementIdle(page);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().tile.y ?? -1)).toBe(initial.movement!.tile.y - 4);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().playerFrame ?? '')).toBe('up-idle');
  await page.keyboard.press('x');
  await expect(page.locator('#hud-energy-text')).toHaveText('98 / 100');
  await expect(page.locator('#hud-log')).toContainText('開墾了一塊田');
  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  await page.reload();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().enabled ?? false)).toBe(true);
  await context.close();
});

test('pixel32 candidate runtime stays off without its exact DEV opt-in and in production', async ({ browser }) => {
  const devContext = await browser.newContext();
  const devPage = await devContext.newPage();
  const devRequests: string[] = [];
  devPage.on('request', (request) => {
    if (candidatePaths.some((path) => request.url().includes(path))) devRequests.push(request.url());
  });
  await devPage.goto('/?renderProfile=pixel32');
  await expect(devPage.locator('#game canvas')).toBeVisible();
  expect(await devPage.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().enabled)).toBe(false);
  expect(devRequests).toEqual([]);
  await devContext.close();

  const productionContext = await browser.newContext();
  const productionPage = await productionContext.newPage();
  const productionRequests: string[] = [];
  productionPage.on('request', (request) => {
    if (candidatePaths.some((path) => request.url().includes(path))) productionRequests.push(request.url());
  });
  const baseUrl = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.PWA_BASE_URL ?? 'http://127.0.0.1:4173';
  await productionPage.goto(`${baseUrl}/${candidateQuery}`);
  await expect(productionPage.locator('#game canvas')).toBeVisible();
  expect(productionRequests).toEqual([]);
  await productionContext.close();
});
