import { expect, test, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';

const profiles = ['legacy', 'pixel32', 'pixel16'] as const;
const viewports = [
  { id: 'phone-portrait-390x844', width: 390, height: 844, touch: true },
  { id: 'phone-landscape-844x390', width: 844, height: 390, touch: true },
  { id: 'tablet-portrait-768x1024', width: 768, height: 1024, touch: true },
  { id: 'desktop-landscape-1280x720', width: 1280, height: 720, touch: false },
  { id: 'desktop-fullhd-1920x1080', width: 1920, height: 1080, touch: false },
] as const;
const dprs = [1, 2, 3] as const;
const evidenceRoot = 'docs/art/candidates/pixel-movement/gate1-runtime-evidence';
const nodeProcess = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process;
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_EVIDENCE === '1';

type RuntimeMeasurement = {
  profile: string;
  viewport: { id: string; width: number; height: number };
  requestedDpr: number;
  browserDpr: number;
  canvasCss: { x: number; y: number; width: number; height: number };
  canvasPixels: { width: number; height: number };
  renderResolution: { width: number; height: number };
  visibleTiles: { width: number; height: number };
  cameraZoom: number;
  screenshot: string;
  sha256: string;
};

async function startFarm(page: Page, profile: string): Promise<void> {
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
  await page.goto(`/?renderProfile=${profile}`);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixelViewport()?.profile ?? '')).toBe(profile);
}

async function idle(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    return movement && movement.heldDirection === null && !movement.moving && !movement.pending;
  })).toBe(true);
}

async function openEvidenceContext(browser: Browser, viewport: typeof viewports[number], dpr: number): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: dpr,
    isMobile: viewport.touch,
    hasTouch: viewport.touch,
  });
}

test('captures the same farm runtime across render profiles, five viewports, and three DPR values', async ({ browser }, testInfo) => {
  test.setTimeout(30 * 60_000);
  const fs = await import('node:' + 'fs/promises');
  const crypto = await import('node:' + 'crypto');
  const measurements: RuntimeMeasurement[] = [];
  const screenshotDirectory = `${evidenceRoot}/screenshots`;
  if (saveEvidence) await fs.mkdir(screenshotDirectory, { recursive: true });

  for (const profile of profiles) {
    for (const dpr of dprs) {
      for (const viewport of viewports) {
        const context = await openEvidenceContext(browser, viewport, dpr);
        const page = await context.newPage();
        await startFarm(page, profile);
        await expect.poll(() => page.evaluate(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
          return canvas?.getBoundingClientRect().width ?? 0;
        })).toBeGreaterThan(0);

        const runtime = await page.evaluate(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
          const debug = window.__dewhollow?.pixelViewport();
          if (!canvas || !debug) throw new Error('缺少 game canvas 或 pixelViewport 診斷');
          const rect = canvas.getBoundingClientRect();
          return {
            profile: debug.profile,
            browserDpr: window.devicePixelRatio,
            canvasCss: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            canvasPixels: { width: canvas.width, height: canvas.height },
            renderResolution: debug.renderResolution,
            visibleTiles: debug.actualWorldTilesVisible,
            cameraZoom: debug.cameraZoom,
          };
        });
        expect(runtime.profile).toBe(profile);
        expect(runtime.browserDpr).toBe(dpr);
        expect(runtime.canvasPixels).toEqual(runtime.renderResolution);
        expect(runtime.visibleTiles.width).toBeGreaterThan(0);
        expect(runtime.visibleTiles.height).toBeGreaterThan(0);
        expect(runtime.cameraZoom).toBeGreaterThan(0);

        const filename = `${profile}-${viewport.id}-dpr-${dpr}.png`;
        const screenshotPath = saveEvidence ? `${screenshotDirectory}/${filename}` : undefined;
        const screenshot = await page.screenshot({ path: screenshotPath, animations: 'disabled', scale: 'css' });
        const sha256 = crypto.createHash('sha256').update(screenshot).digest('hex');
        measurements.push({
          viewport: { id: viewport.id, width: viewport.width, height: viewport.height },
          requestedDpr: dpr,
          ...runtime,
          screenshot: `screenshots/${filename}`,
          sha256,
        });
        await testInfo.attach(filename, { body: screenshot, contentType: 'image/png' });
        await context.close();
      }
    }
  }

  const matrix = {
    schemaVersion: 1,
    generatedBy: 'tests/e2e/gate1-runtime-evidence.spec.ts',
    evidenceMode: saveEvidence ? 'saved-to-repository' : 'playwright-attachments',
    claim: 'Chromium runtime render-profile and viewport/DPR evidence; not native 8-bit/16-bit art or physical-device evidence.',
    measurements,
  };
  const body = new TextEncoder().encode(`${JSON.stringify(matrix, null, 2)}\n`);
  if (saveEvidence) await fs.writeFile(`${evidenceRoot}/matrix.json`, body);
  await testInfo.attach('gate1-runtime-matrix.json', { body, contentType: 'application/json' });
  expect(measurements).toHaveLength(profiles.length * viewports.length * dprs.length);
});

test('records comparable farm movement and farming input clips for all render profiles', async ({ browser }, testInfo) => {
  test.setTimeout(5 * 60_000);
  const fs = await import('node:' + 'fs/promises');
  const videoDirectory = `${evidenceRoot}/videos`;
  const localVideoDirectory = testInfo.outputPath();
  if (saveEvidence) await fs.mkdir(videoDirectory, { recursive: true });
  const evidence: Array<Record<string, unknown>> = [];

  for (const profile of profiles) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      recordVideo: { dir: localVideoDirectory, size: { width: 390, height: 844 } },
    });
    const page = await context.newPage();
    const video = page.video();
    const recordingStartedAt = Date.now();
    const elapsedMs = (): number => Date.now() - recordingStartedAt;
    await startFarm(page, profile);
    const start = await page.evaluate(() => {
      const actors = window.__dewhollow?.actors() ?? [];
      const player = actors.find((actor) => actor.id === 'player');
      if (!player) throw new Error('找不到 farm player');
      return {
        x: player.tileX,
        y: player.tileY,
        actorIds: actors.map((actor) => actor.id),
        followers: actors.filter((actor) => actor.id !== 'player').map((actor) => ({ id: actor.id, x: actor.tileX, y: actor.tileY })),
      };
    });
    const timeline: Array<Record<string, unknown>> = [{ event: 'idle', elapsedMs: elapsedMs(), tile: start }];

    await page.waitForTimeout(700);
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction((targetX) => {
      const player = window.__dewhollow?.actors().find((actor) => actor.id === 'player');
      return player !== undefined && player.tileX >= targetX;
    }, start.x + 10, { timeout: 15_000 });
    await page.keyboard.up('ArrowRight');
    await idle(page);
    const outbound = await page.evaluate(() => window.__dewhollow?.actors().find((actor) => actor.id === 'player'));
    const followersAfterMove = await page.evaluate(() => (window.__dewhollow?.actors() ?? [])
      .filter((actor) => actor.id !== 'player')
      .map((actor) => ({ id: actor.id, x: actor.tileX, y: actor.tileY })));
    timeline.push({ event: 'held-right-10-tiles', elapsedMs: elapsedMs(), tile: outbound && { x: outbound.tileX, y: outbound.tileY }, followers: followersAfterMove });
    expect((outbound?.tileX ?? start.x) - start.x).toBe(10);
    expect(start.followers.some((follower) => followersAfterMove.some((after) => after.id === follower.id && (after.x !== follower.x || after.y !== follower.y)))).toBe(true);

    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction((targetX) => {
      const player = window.__dewhollow?.actors().find((actor) => actor.id === 'player');
      return player !== undefined && player.tileX <= targetX;
    }, start.x, { timeout: 15_000 });
    await page.keyboard.up('ArrowLeft');
    await idle(page);
    timeline.push({ event: 'held-left-return', elapsedMs: elapsedMs(), tile: await page.evaluate(() => window.__dewhollow?.movement()?.tile) });

    for (const key of ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft']) {
      await page.keyboard.press(key);
      await idle(page);
    }
    timeline.push({ event: 'four-direction-turns', elapsedMs: elapsedMs(), tile: await page.evaluate(() => window.__dewhollow?.movement()?.tile) });

    const beforeDiagonal = await page.evaluate(() => window.__dewhollow?.movement()?.tile);
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(450);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('ArrowUp');
    await idle(page);
    const afterDiagonal = await page.evaluate(() => window.__dewhollow?.movement()?.tile);
    timeline.push({ event: 'simultaneous-up-right-resolves-through-grid-input', elapsedMs: elapsedMs(), before: beforeDiagonal, after: afterDiagonal });

    // Return to the deterministic farm start, then hoe the known plot directly north at (7, 4).
    let position = await page.evaluate(() => window.__dewhollow?.movement()?.tile);
    while (position && position.y < start.y) {
      await page.keyboard.press('ArrowDown');
      await idle(page);
      position = await page.evaluate(() => window.__dewhollow?.movement()?.tile);
    }
    while (position && position.x < start.x) {
      await page.keyboard.press('ArrowRight');
      await idle(page);
      position = await page.evaluate(() => window.__dewhollow?.movement()?.tile);
    }
    while (position && position.x > start.x) {
      await page.keyboard.press('ArrowLeft');
      await idle(page);
      position = await page.evaluate(() => window.__dewhollow?.movement()?.tile);
    }
    for (let step = 0; step < 4; step += 1) {
      const before = await page.evaluate(() => window.__dewhollow?.movement()?.tile?.y ?? 0);
      await page.keyboard.press('ArrowUp');
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement()?.tile?.y ?? 0)).toBe(before - 1);
      await idle(page);
    }
    await page.keyboard.press('x');
    await expect(page.locator('#hud-energy-text')).toHaveText('98 / 100');
    timeline.push({ event: 'hoe-farm-plot', elapsedMs: elapsedMs(), tile: await page.evaluate(() => window.__dewhollow?.movement()?.tile), energy: await page.locator('#hud-energy-text').innerText() });
    await page.waitForTimeout(800);

    const videoPath = await video?.path();
    await context.close();
    if (!videoPath) throw new Error(`Playwright 沒有產生 ${profile} 影片`);
    const filename = `${profile}-movement-and-farming.webm`;
    const destination = saveEvidence ? `${videoDirectory}/${filename}` : videoPath;
    if (saveEvidence) await video?.saveAs(destination);
    await testInfo.attach(filename, { path: destination, contentType: 'video/webm' });
    evidence.push({ profile, video: `videos/${filename}`, viewport: '390x844 CSS px', dpr: 2, start, events: timeline, output: 'Chromium Playwright emulation; existing game assets remain active.' });
  }

  const operationLog = { schemaVersion: 1, claim: 'Chromium input timeline and recording; simultaneous directions use the existing grid input resolver and do not imply diagonal world movement.', recordings: evidence };
  const body = new TextEncoder().encode(`${JSON.stringify(operationLog, null, 2)}\n`);
  if (saveEvidence) await fs.writeFile(`${videoDirectory}/movement-and-farming.json`, body);
  await testInfo.attach('gate1-runtime-operation-timeline.json', { body, contentType: 'application/json' });
  expect(evidence).toHaveLength(profiles.length);
});
