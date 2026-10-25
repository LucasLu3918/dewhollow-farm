import { expect, test } from '@playwright/test';

const route = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1AssetPreview=pixel32-candidates';
const candidateRoot = '/docs/art/candidates/pixel-movement';
const reviewRoot = 'docs/art/candidates/pixel-movement/gate1-candidate-assets-review';
const viewports = [
  { id: 'phone-portrait-390x844', width: 390, height: 844, touch: true },
  { id: 'phone-landscape-844x390', width: 844, height: 390, touch: true },
  { id: 'tablet-portrait-768x1024', width: 768, height: 1024, touch: true },
  { id: 'desktop-landscape-1280x720', width: 1280, height: 720, touch: false },
  { id: 'desktop-fullhd-1920x1080', width: 1920, height: 1080, touch: false },
] as const;
const dprs = [1, 2, 3] as const;
const nodeProcess = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process;
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_CANDIDATE_ASSETS_EVIDENCE === '1';

test('captures DEV-only crop, pet, tool, and object candidates across five viewports and three DPR values', async ({ browser }, testInfo) => {
  test.setTimeout(15 * 60_000);
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const crypto = await import('node:' + 'crypto');
  const childProcess = await import('node:' + 'child_process');
  const sha256 = (bytes: Uint8Array) => crypto.createHash('sha256').update(bytes).digest('hex');
  const root = path.resolve(nodeProcess?.cwd() ?? '.', reviewRoot);
  if (saveEvidence) await fs.mkdir(path.join(root, 'screenshots'), { recursive: true });
  const testedSourceFiles = await Promise.all([
    'src/presentation/scenes/MapScene.ts',
    'tests/e2e/gate1-candidate-assets-review.spec.ts',
  ].map(async (file) => ({ path: file, sha256: sha256(await fs.readFile(path.resolve(nodeProcess?.cwd() ?? '.', file))) })));

  const captures: unknown[] = [];
  for (const viewport of viewports) for (const dpr of dprs) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: dpr,
      isMobile: viewport.touch,
      hasTouch: viewport.touch,
    });
    const page = await context.newPage();
    const candidateRequests: string[] = [];
    const candidateFailures: string[] = [];
    const pageErrors: string[] = [];
    const consoleWarningsOrErrors: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/gate1-assets/') || request.url().includes('/gate1-pets-pixel32/')) {
        candidateRequests.push(new URL(request.url()).pathname);
      }
    });
    page.on('requestfailed', (request) => {
      if (request.url().includes('/gate1-assets/') || request.url().includes('/gate1-pets-pixel32/')) candidateFailures.push(request.url());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'warning' || message.type() === 'error') consoleWarningsOrErrors.push(`${message.type()}: ${message.text()}`);
    });
    await page.addInitScript(() => {
      let first = true;
      const original = Math.random;
      Math.random = () => {
        if (first) { first = false; Math.random = original; return 0; }
        return original();
      };
    });
    await page.goto(route);
    await expect(page.locator('#game canvas')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.candidateAssetReview().enabled ?? false)).toBe(true);

    await page.evaluate(() => new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('dewhollow-farm');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const database = open.result;
        const transaction = database.transaction('saves', 'readwrite');
        transaction.objectStore('saves').put({
          slot: 'slot-1', savedAt: '2026-10-26T00:00:00.000Z',
          state: {
            schemaVersion: 13, calendar: { year: 1, season: 'spring', day: 4, minuteOfDay: 600 },
            weather: 'sunny', forecast: 'sunny', energy: { current: 100, max: 100 }, gold: 600,
            mapId: 'farm', player: { x: 5, y: 5, facing: 'down' },
            plots: {
              '3,6': { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 0 } },
              '4,6': { watered: true, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 1 } },
              '5,6': { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 3 } },
              '6,6': { watered: false, dryDays: 0, crop: { cropId: 'moon-bean', growthDays: 2 } },
            },
            inventory: { capacity: 24, stacks: [] }, shipBox: { entries: [] }, flags: {}, rng: 12345,
            tool: 'hoe', toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
            worldChanges: {}, skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 }, talents: {},
            animals: [], cows: [], sheep: [], processing: [], fishing: null, mineSeed: 1, mineCheckpoint: 1,
            selectedSeed: 'sweet-radish', playtimeSeconds: 0,
          },
        });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      }
    }));
    await page.reload();
    await expect(page.locator('#game canvas')).toBeVisible();
    await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.candidateAssetReview().items.length ?? 0)).toBe(22);
    await page.evaluate(() => window.__dewhollow?.pauseScene({ preservePose: false }));

    const state = await page.evaluate(() => {
      const debug = window.__dewhollow;
      const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
      if (!debug || !canvas) throw new Error('Missing candidate review diagnostics or canvas');
      const rect = canvas.getBoundingClientRect();
      return {
        review: debug.candidateAssetReview(),
        sprites: debug.sprites(),
        viewport: debug.pixelViewport(),
        canvasCss: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        camera: debug.cameraView(),
        productionTextures: [debug.textureSize('pet.cat'), debug.textureSize('pet.marsupial')],
      };
    });

    const expectedFrames = [
      'seed', 'sprout', 'mature',
      'cat-down-idle', 'cat-up-idle', 'cat-left-idle', 'cat-right-idle',
      'quokka-down-idle', 'quokka-up-idle', 'quokka-left-idle', 'quokka-right-idle',
      'tool-hoe', 'tool-can', 'tool-seedbag', 'tool-axe', 'tool-pick', 'tool-rod', 'tool-sickle',
      'door-closed', 'door-open', 'shipbox-closed', 'shipbox-open',
    ];
    expect(state.review.enabled).toBe(true);
    expect(state.review.items.map((item) => item.frame)).toEqual(expectedFrames);
    expect(state.review.items.every((item) => item.x - 16 * item.scale >= 8
      && item.x + 16 * item.scale <= state.viewport.actualCanvasResolution.width - 8),
    `${viewport.id} DPR${dpr}: ${JSON.stringify({ canvas: state.viewport.actualCanvasResolution, items: state.review.items.map(({ frame, x, scale }) => ({ frame, x, scale })) })}`).toBe(true);
    expect(state.review.items.every((item) => item.labelX >= 8
      && item.labelX + item.labelWidth <= state.viewport.actualCanvasResolution.width - 24),
    `${viewport.id} DPR${dpr}: review label exceeds board width`).toBe(true);
    expect(state.review.items.every((item) => item.y + 16 * item.scale <= state.viewport.actualCanvasResolution.height),
      `${viewport.id} DPR${dpr}: ${JSON.stringify({ canvas: state.viewport.actualCanvasResolution, items: state.review.items.map(({ frame, y, scale }) => ({ frame, y, scale })) })}`).toBe(true);
    expect(state.review.items.every((item) => item.y - 16 * item.scale >= 8)).toBe(true);
    expect(state.review.items.every((item) => item.labelY + 20 <= item.y - 16 * item.scale)).toBe(true);
    const rowCenters = [...new Set(state.review.items.map((item) => item.y))];
    expect(rowCenters).toHaveLength(5);
    expect(rowCenters.slice(1).every((center, index) => center - rowCenters[index]! >= 32)).toBe(true);
    expect(state.review.items.every((item) => item.scale > 0 && item.texture.startsWith('gate1-pixel32-'))).toBe(true);
    expect(state.sprites.filter((sprite) => sprite.key === 'gate1-pixel32-crops-atlas').map((sprite) => sprite.frame))
      .toEqual(expect.arrayContaining(['seed', 'sprout', 'mature']));
    expect(state.sprites.some((sprite) => sprite.key === 'gate1-pixel32-crops-atlas' && sprite.frame === 'cropSprout')).toBe(false);
    expect(state.sprites.some((sprite) => sprite.key === 'crop.moon-bean')).toBe(true);
    expect(state.productionTextures).toEqual([{ width: 96, height: 96 }, { width: 96, height: 96 }]);
    expect(state.canvasCss).toEqual({ x: expect.any(Number), y: expect.any(Number), width: expect.any(Number), height: expect.any(Number) });
    expect(state.review.limitations.join(' ')).toContain('static directional samples');

    const manifestPaths = [
      `${candidateRoot}/gate1-assets/pixel32-crops/manifest.json`,
      `${candidateRoot}/gate1-assets/pixel32-crops/sweet-radish-stages.png`,
      `${candidateRoot}/gate1-assets/pixel32-interactables/manifest.json`,
      `${candidateRoot}/gate1-assets/pixel32-interactables/interactables-atlas.png`,
      `${candidateRoot}/gate1-pets-pixel32/manifest.json`,
      `${candidateRoot}/gate1-pets-pixel32/pets-pixel32.png`,
    ];
    expect(candidateRequests).toEqual(expect.arrayContaining(manifestPaths));
    expect(candidateFailures).toEqual([]);
    expect(pageErrors).toEqual([]);

    const evidenceInputs = await Promise.all(manifestPaths.map(async (relative) => {
      const file = path.resolve(nodeProcess?.cwd() ?? '.', relative.slice(1));
      const bytes = await fs.readFile(file);
      return { path: relative, sha256: sha256(bytes), bytes: bytes.byteLength };
    }));
    const screenshot = await page.screenshot({
      path: saveEvidence ? path.join(root, 'screenshots', `${viewport.id}-dpr-${dpr}-candidate-board.png`) : undefined,
      animations: 'disabled',
      scale: 'css',
    });
    await page.evaluate(async () => {
      window.__dewhollow?.setCandidateAssetReviewVisible(false);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    const farmCropFrames = await page.evaluate(() => window.__dewhollow?.sprites()
      .filter((sprite) => sprite.key === 'gate1-pixel32-crops-atlas')
      .map((sprite) => sprite.frame) ?? []);
    expect(farmCropFrames).toEqual(expect.arrayContaining(['seed', 'sprout', 'mature']));
    const farmScreenshot = await page.screenshot({
      path: saveEvidence ? path.join(root, 'screenshots', `${viewport.id}-dpr-${dpr}-farm-crops.png`) : undefined,
      animations: 'disabled',
      scale: 'css',
    });
    const baseRevision = childProcess.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const readManifest = async (index: number) => {
      const file = path.resolve(nodeProcess?.cwd() ?? '.', manifestPaths[index]!.slice(1));
      return JSON.parse(await fs.readFile(file, 'utf8')) as {
        status: string;
        approved: boolean;
        frames: Record<string, { sha256?: string }>;
      };
    };
    const cropManifest = await readManifest(0);
    const interactablesManifest = await readManifest(2);
    const petsManifest = await readManifest(4);
    for (const manifest of [cropManifest, interactablesManifest, petsManifest]) {
      expect(manifest.status).toBe('candidate');
      expect(manifest.approved).toBe(false);
    }
    const frameHashes = {
      crops: cropManifest.frames,
      cat: petsManifest.frames,
      quokka: petsManifest.frames,
      tools: interactablesManifest.frames,
      objects: interactablesManifest.frames,
    };
    const evidence = {
      schemaVersion: 1,
      generatedBy: 'tests/e2e/gate1-candidate-assets-review.spec.ts',
      capturedAt: new Date().toISOString(),
      captureProvider: 'Playwright Chromium desktop context',
      baseRevision,
      route,
      claim: 'DEV-only Pixel32 visual contact sheet for three crop stages, cat/quokka cardinal idle frames, held-preview tools, and static door/shipbox states; sweet-radish candidate is also rendered in the fixed farm save.',
      candidateState: {
        manifests: [cropManifest, petsManifest, interactablesManifest].map(({ status, approved }) => ({ status, approved })),
        status: 'candidate',
        approved: false,
      },
      testedSourceFiles,
      inputs: evidenceInputs,
      visibleFrames: state.review.items.map((item) => ({
        ...item,
        frameSha256: frameHashes[item.group as keyof typeof frameHashes][item.frame]?.sha256 ?? null,
      })),
      viewport: { id: viewport.id, width: viewport.width, height: viewport.height, dpr, browserDpr: await page.evaluate(() => window.devicePixelRatio), screenshotScale: 'css', canvasCss: state.canvasCss, canvasResolution: state.viewport.actualCanvasResolution, renderResolution: state.viewport.renderResolution, camera: state.camera },
      productionIsolation: { formalPetTextures: state.productionTextures, candidateTextures: [...new Set(state.review.items.map((item) => item.texture))] },
      requests: [...new Set(candidateRequests)],
      failures: candidateFailures,
      consoleWarningsOrErrors,
      pageErrors,
      screenshot: { path: `screenshots/${viewport.id}-dpr-${dpr}-candidate-board.png`, sha256: sha256(screenshot), bytes: screenshot.byteLength },
      farmSceneScreenshot: {
        path: `screenshots/${viewport.id}-dpr-${dpr}-farm-crops.png`,
        sha256: sha256(farmScreenshot),
        bytes: farmScreenshot.byteLength,
        visibleCropFrames: farmCropFrames,
      },
      limitations: [
        ...state.review.limitations,
        'This is a CSS-scale Chromium capture, not native DPR raster or iOS/Android device evidence.',
        'Manifest hash/checker evidence does not establish visual quality or exact-hash approval.',
        'The candidate atlas and preview are not registered in content/assets.json or public assets.',
      ],
    };
    const boardFilename = `${viewport.id}-dpr-${dpr}-candidate-board.png`;
    const farmFilename = `${viewport.id}-dpr-${dpr}-farm-crops.png`;
    await testInfo.attach(boardFilename, { body: screenshot, contentType: 'image/png' });
    await testInfo.attach(farmFilename, { body: farmScreenshot, contentType: 'image/png' });
    captures.push({ ...evidence, viewport: { ...viewport, ...evidence.viewport } });
    await context.close();
  }

  expect(captures).toHaveLength(viewports.length * dprs.length);
  const matrix = {
    schemaVersion: 1,
    generatedBy: 'tests/e2e/gate1-candidate-assets-review.spec.ts',
    capturedAt: new Date().toISOString(),
    baseRevision: childProcess.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    candidateState: { status: 'candidate', approved: false },
    viewports,
    dprs,
    screenshotScale: 'css',
    claim: 'Thirty Chromium-emulated captures show the DEV-only crop, pet, tool, and object candidate board plus the same fixed farm crop scene across five viewport shapes and DPR 1/2/3. Screenshots are CSS-scale output; this does not establish native DPR raster, device behavior, visual approval, or Gate 1 completion.',
    captures,
    testedSourceFiles,
    limitations: [
      'Every viewport uses the same farm save fixture and candidate asset bytes.',
      'DPR is browser-emulated; screenshots use CSS scale and are not native device captures.',
      'Manifest hash/checker evidence does not establish visual quality or exact-hash approval.',
      'Candidate assets remain outside content/assets.json and public assets.',
    ],
  };
  const matrixReport = `${JSON.stringify(matrix, null, 2)}\n`;
  await testInfo.attach('gate1-candidate-assets-review-matrix.json', { body: matrixReport, contentType: 'application/json' });
  if (saveEvidence) await fs.writeFile(path.join(root, 'matrix.json'), matrixReport);
});
