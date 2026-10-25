import { expect, test, type Browser } from '@playwright/test';

const previewQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1InteractablePreview=pixel32-interactables';
const interactablesRoot = 'docs/art/candidates/pixel-movement/gate1-assets/pixel32-interactables';
const evidenceRoot = 'docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-interactables-viewport-matrix';
const viewports = [
  { id: 'phone-portrait-390x844', width: 390, height: 844, touch: true },
  { id: 'phone-landscape-844x390', width: 844, height: 390, touch: true },
  { id: 'tablet-portrait-768x1024', width: 768, height: 1024, touch: true },
  { id: 'desktop-landscape-1280x720', width: 1280, height: 720, touch: false },
  { id: 'desktop-fullhd-1920x1080', width: 1920, height: 1080, touch: false },
] as const;
const dprs = [1, 2, 3] as const;
const expectedFrames = [
  { id: 'door-closed', frame: 'door-closed', tileX: 2, tileY: 4 },
  { id: 'door-open', frame: 'door-open', tileX: 4, tileY: 4 },
  { id: 'shipbox-closed', frame: 'shipbox-closed', tileX: 2, tileY: 7 },
  { id: 'shipbox-open', frame: 'shipbox-open', tileX: 4, tileY: 7 },
] as const;
const nodeProcess = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process;
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_INTERACTABLES_MATRIX_EVIDENCE === '1';

async function seedFarmSave(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put({
        slot: 'slot-1',
        savedAt: '2026-10-26T00:00:00.000Z',
        state: {
          schemaVersion: 13,
          calendar: { year: 1, season: 'spring', day: 4, minuteOfDay: 600 },
          weather: 'sunny', forecast: 'sunny', energy: { current: 100, max: 100 }, gold: 600,
          mapId: 'farm', player: { x: 4, y: 5, facing: 'down' }, plots: {},
          inventory: { capacity: 24, stacks: [] }, shipBox: { entries: [] }, flags: {}, rng: 12345,
          tool: 'hoe', toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
          worldChanges: {}, skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 }, talents: {},
          animals: [], cows: [], sheep: [], processing: [], fishing: null, mineSeed: 1, mineCheckpoint: 1,
          selectedSeed: 'sweet-radish', playtimeSeconds: 0,
        },
      });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  }));
  await page.reload();
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().tile ?? null)).toMatchObject({ x: 4, y: 5 });
}

async function openPreview(browser: Browser, viewport: typeof viewports[number], dpr: number) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: dpr,
    isMobile: viewport.touch,
    hasTouch: viewport.touch,
  });
  const page = await context.newPage();
  const candidateRequests: string[] = [];
  const candidateFailures: string[] = [];
  const candidateHttpFailures: string[] = [];
  const pageErrors: string[] = [];
  const consoleWarningsOrErrors: string[] = [];
  const candidatePaths = [
    `${interactablesRoot}/manifest.json`,
    `${interactablesRoot}/interactables-atlas.png`,
  ];
  page.on('request', (request) => {
    if (candidatePaths.some((candidatePath) => request.url().includes(candidatePath))) {
      candidateRequests.push(new URL(request.url()).pathname);
    }
  });
  page.on('requestfailed', (request) => {
    if (candidatePaths.some((candidatePath) => request.url().includes(candidatePath))) candidateFailures.push(request.url());
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && candidatePaths.some((candidatePath) => response.url().includes(candidatePath))) {
      candidateHttpFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') consoleWarningsOrErrors.push(`${message.type()}: ${message.text()}`);
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
  await page.goto(previewQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateInteractables().enabled ?? false)).toBe(true);
  await seedFarmSave(page);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateInteractables().items.length ?? 0)).toBe(4);
  return { context, page, candidateRequests, candidateFailures, candidateHttpFailures, pageErrors, consoleWarningsOrErrors };
}

test('captures the unapproved interactables preview across five viewports and three Chromium DPR values', async ({ browser }, testInfo) => {
  test.setTimeout(15 * 60_000);
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const crypto = await import('node:' + 'crypto');
  const childProcess = await import('node:' + 'child_process');
  const root = path.resolve(nodeProcess?.cwd() ?? '.');
  const resolvePath = (repositoryPath: string) => path.resolve(root, repositoryPath);
  const sha256 = (bytes: Uint8Array) => crypto.createHash('sha256').update(bytes).digest('hex');
  const fileSha256 = async (repositoryPath: string) => sha256(await fs.readFile(resolvePath(repositoryPath)));
  const screenshotsRoot = `${evidenceRoot}/screenshots`;
  if (saveEvidence) await fs.mkdir(resolvePath(screenshotsRoot), { recursive: true });

  const manifestPath = `${interactablesRoot}/manifest.json`;
  const atlasPath = `${interactablesRoot}/interactables-atlas.png`;
  const manifestBytes = await fs.readFile(resolvePath(manifestPath));
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as {
    status: string;
    approved: boolean;
    atlas: { file: string; sha256: string };
    frames: Record<string, { approved: boolean; sha256: string }>;
  };
  const inputHashes = {
    manifestSha256: sha256(manifestBytes),
    atlasSha256: await fileSha256(atlasPath),
    frameSha256: Object.fromEntries(expectedFrames.map(({ frame }) => [frame, manifest.frames[frame]?.sha256])),
  };
  expect(manifest).toMatchObject({ status: 'candidate', approved: false, atlas: { file: 'interactables-atlas.png', sha256: inputHashes.atlasSha256 } });
  expect(Object.values(manifest.frames).every(({ approved }) => approved === false)).toBe(true);
  for (const { frame } of expectedFrames) expect(manifest.frames[frame]?.sha256).toMatch(/^[a-f0-9]{64}$/);

  const captures: Record<string, unknown>[] = [];
  for (const viewport of viewports) {
    for (const dpr of dprs) {
      const { context, page, candidateRequests, candidateFailures, candidateHttpFailures, pageErrors, consoleWarningsOrErrors } = await openPreview(browser, viewport, dpr);
      const state = await page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
        const debug = window.__dewhollow;
        if (!canvas || !debug) throw new Error('Missing MapScene canvas or DEV diagnostics');
        const rect = canvas.getBoundingClientRect();
        return {
          mapId: debug.mapId(),
          playerTile: debug.movement().tile,
          browserDpr: window.devicePixelRatio,
          canvasCss: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          canvasPixels: { width: canvas.width, height: canvas.height },
          viewport: debug.pixelViewport(),
          camera: debug.cameraView(),
          preview: debug.pixel32CandidateInteractables(),
        };
      });
      expect(state.mapId).toBe('farm');
      expect(state.playerTile).toMatchObject({ x: 4, y: 5 });
      expect(state.browserDpr).toBe(dpr);
      expect(state.canvasCss.width).toBeGreaterThan(0);
      expect(state.canvasCss.height).toBeGreaterThan(0);
      expect(state.canvasPixels).toEqual(state.viewport.renderResolution);
      expect(state.viewport.actualWorldTilesVisible.width).toBeGreaterThan(0);
      expect(state.viewport.actualWorldTilesVisible.height).toBeGreaterThan(0);
      expect(state.viewport.cameraZoom).toBeGreaterThan(0);
      expect(state.camera.zoom).toBeGreaterThan(0);
      expect(state.preview).toMatchObject({ enabled: true, status: 'candidate', approved: false });
      expect(state.preview.items.map(({ id, frame, tileX, tileY, visible }) => ({ id, frame, tileX, tileY, visible })))
        .toEqual(expectedFrames.map((item) => ({ ...item, visible: true })));
      expect(candidateRequests).toEqual(expect.arrayContaining([`/${manifestPath}`, `/${atlasPath}`]));
      expect(candidateFailures).toEqual([]);
      expect(candidateHttpFailures).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(consoleWarningsOrErrors.filter((message) => message.startsWith('error:'))).toEqual([]);

      await page.evaluate(() => window.__dewhollow?.pauseScene({ preservePose: false }));
      const filename = `${viewport.id}-dpr-${dpr}.png`;
      const screenshot = await page.screenshot({
        path: saveEvidence ? resolvePath(path.join(screenshotsRoot, filename)) : undefined,
        animations: 'disabled',
        scale: 'css',
      });
      expect(screenshot.readUInt32BE(16)).toBe(viewport.width);
      expect(screenshot.readUInt32BE(20)).toBe(viewport.height);
      await testInfo.attach(filename, { body: screenshot, contentType: 'image/png' });
      captures.push({
        viewport: { id: viewport.id, width: viewport.width, height: viewport.height, touch: viewport.touch },
        requestedDpr: dpr,
        browserDpr: state.browserDpr,
        mapId: state.mapId,
        playerTile: state.playerTile,
        canvasCss: state.canvasCss,
        canvasPixels: state.canvasPixels,
        viewportMeasurement: state.viewport,
        camera: state.camera,
        preview: state.preview,
        candidateRequests: [...new Set(candidateRequests)].sort(),
        candidateFailures,
        candidateHttpFailures,
        pageErrors,
        consoleWarningsOrErrors,
        screenshot: `screenshots/${filename}`,
        screenshotScale: 'css',
        screenshotSha256: sha256(screenshot),
      });
      await context.close();
    }
  }

  expect(captures).toHaveLength(viewports.length * dprs.length);
  const baseRevision = childProcess.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const evidence = {
    schemaVersion: 1,
    generatedBy: 'tests/e2e/gate1-mapscene-pixel32-interactables-viewport-matrix.spec.ts',
    evidenceMode: saveEvidence ? 'saved-to-repository' : 'playwright-attachments',
    baseRevision,
    route: previewQuery,
    status: 'candidate',
    approved: false,
    scope: 'DEV farm MapScene candidate visual QA only; no runtime, gameplay, production asset or approval change',
    inputHashes,
    viewports,
    dprs,
    captures,
    limitations: [
      'Chromium viewport and deviceScaleFactor emulation only; screenshots are CSS-scale, not native DPR raster evidence.',
      'Machine checks establish loading, frame visibility and canvas/camera measurements, not visual readability, artistic quality, seams or exact asset approval.',
      'The repository-wide API/consumer/data/event Impact Graph remains partial; this bounded change only extends candidate QA evidence.',
      'Native iOS/Android behavior remains DEVICE_PENDING.',
    ],
  };
  if (saveEvidence) await fs.writeFile(resolvePath(`${evidenceRoot}/evidence.json`), `${JSON.stringify(evidence, null, 2)}\n`);
});
