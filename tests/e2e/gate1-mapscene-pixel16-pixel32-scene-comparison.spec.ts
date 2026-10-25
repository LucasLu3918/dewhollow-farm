import { expect, test, type Browser, type Page } from '@playwright/test';

const candidateRoot = 'docs/art/candidates/pixel-movement/gate1-assets';
const evidenceRoot = 'docs/art/candidates/pixel-movement/gate1-mapscene-pixel16-pixel32-scene-comparison';
const profiles = [
  { id: 'pixel16', candidate: '8bit', query: '?renderProfile=pixel16' },
  {
    id: 'pixel32',
    candidate: '16bit',
    query: '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1OverlayPreview=pixel32-overlay-12x10',
  },
] as const;
const nodeProcess = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process;
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_PIXEL_PROFILE_COMPARISON_EVIDENCE === '1';

const farmSave = {
  slot: 'slot-1',
  savedAt: '2026-10-26T00:00:00.000Z',
  state: {
    schemaVersion: 13,
    calendar: { year: 1, season: 'spring', day: 4, minuteOfDay: 600 },
    weather: 'sunny', forecast: 'sunny', energy: { current: 100, max: 100 }, gold: 600,
    mapId: 'farm', player: { x: 5, y: 5, facing: 'down' },
    plots: {
      '3,6': { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 0 } },
      '4,6': { watered: true, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 1 } },
      '5,6': { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 3 } },
    },
    inventory: { capacity: 24, stacks: [] }, shipBox: { entries: [] }, flags: {}, rng: 12345,
    tool: 'hoe', toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
    worldChanges: {}, skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 }, talents: {},
    animals: [], cows: [], sheep: [], processing: [], fishing: null, mineSeed: 1, mineCheckpoint: 1,
    selectedSeed: 'sweet-radish', playtimeSeconds: 0,
  },
};

async function seedFarmSave(page: Page): Promise<void> {
  await page.evaluate((save) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put(save);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  }), farmSave);
}

async function captureProfile(browser: Browser, profile: typeof profiles[number]) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const candidateRequests = new Set<string>();
  const candidateFailures: string[] = [];
  const candidateHttpFailures: string[] = [];
  const pageErrors: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/gate1-assets/')) candidateRequests.add(new URL(request.url()).pathname);
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('/gate1-assets/')) candidateFailures.push(request.url());
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().includes('/gate1-assets/')) {
      candidateHttpFailures.push(response.status() + ' ' + response.url());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
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

  try {
    await page.goto(profile.query);
    await expect(page.locator('#game canvas')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
    await seedFarmSave(page);
    await page.reload();
    await expect(page.locator('#game canvas')).toBeVisible();
    await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixelViewport().profile ?? '')).toBe(profile.id);
    if (profile.id === 'pixel16') {
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.candidateArt().candidate ?? '')).toBe(profile.candidate);
    } else {
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.candidateArt().candidate ?? null)).toBeNull();
    }
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().enabled ?? false))
      .toBe(profile.id === 'pixel32');
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateOverlays().enabled ?? false))
      .toBe(profile.id === 'pixel32');
    await page.evaluate(() => window.__dewhollow?.pauseScene({ preservePose: false }));

    const candidateTextureKeys = profile.id === 'pixel16'
      ? ['gate1-candidate-atlas']
      : ['gate1-pixel32-map-atlas', 'gate1-pixel32-animation-atlas'];
    const diagnostics = await page.evaluate((candidateKeys) => {
      const debug = window.__dewhollow;
      const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
      if (!debug || !canvas) throw new Error('Missing MapScene diagnostics or canvas');
      const rect = canvas.getBoundingClientRect();
      const sprites = debug.sprites();
      const sourceCounts = new Map<string, { key: string; frame: string | null; source: 'candidate' | 'existing'; count: number }>();
      for (const sprite of sprites) {
        const source = candidateKeys.includes(sprite.key) ? 'candidate' : 'existing';
        const groupKey = [source, sprite.key, sprite.frame ?? ''].join('|');
        const item = sourceCounts.get(groupKey) ?? { key: sprite.key, frame: sprite.frame, source, count: 0 };
        item.count += 1;
        sourceCounts.set(groupKey, item);
      }
      return {
        mapId: debug.mapId(),
        candidateArt: debug.candidateArt(),
        pixel32Runtime: debug.pixel32CandidateRuntime(),
        overlays: debug.pixel32CandidateOverlays(),
        viewport: debug.pixelViewport(),
        camera: debug.cameraView(),
        canvasCss: { width: rect.width, height: rect.height },
        spriteSources: [...sourceCounts.values()].sort((left, right) =>
          left.source.localeCompare(right.source) || left.key.localeCompare(right.key) || (left.frame ?? '').localeCompare(right.frame ?? '')),
        candidateSprites: [...sourceCounts.values()].filter((source) => source.source === 'candidate'),
        cropFrames: sprites.filter((sprite) => sprite.key === 'crop.sweet-radish'
          || (sprite.key === 'gate1-candidate-atlas'
            && ['cropSeed', 'cropSprout', 'cropMature'].includes(sprite.frame ?? '')))
          .map(({ key, frame }) => ({ key, frame })),
      };
    }, candidateTextureKeys);
    const screenshot = await page.locator('#game').screenshot({ animations: 'disabled', scale: 'css' });
    return {
      profile: profile.id,
      candidate: profile.candidate,
      diagnostics,
      candidateRequests: [...candidateRequests].sort(),
      candidateFailures,
      candidateHttpFailures,
      pageErrors,
      screenshot,
    };
  } finally {
    await context.close();
  }
}

test('captures a matched partial-coverage pixel16 and pixel32 farm comparison', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const crypto = await import('node:' + 'crypto');
  const root = path.resolve(nodeProcess?.cwd() ?? '.', evidenceRoot);
  if (saveEvidence) await fs.mkdir(path.join(root, 'screenshots'), { recursive: true });

  const captures = [];
  for (const profile of profiles) captures.push(await captureProfile(browser, profile));

  const pixel16 = captures[0]!;
  const pixel32 = captures[1]!;
  expect(pixel16.diagnostics.mapId).toBe('farm');
  expect(pixel32.diagnostics.mapId).toBe('farm');
  expect(pixel16.diagnostics.viewport.profile).toBe('pixel16');
  expect(pixel32.diagnostics.viewport.profile).toBe('pixel32');
  expect(pixel16.diagnostics.candidateArt.candidate).toBe('8bit');
  expect(pixel32.diagnostics.candidateArt.candidate).toBeNull();
  expect(pixel16.diagnostics.camera.width).toBe(pixel32.diagnostics.camera.width);
  expect(pixel16.diagnostics.camera.height).toBe(pixel32.diagnostics.camera.height);
  expect(pixel16.diagnostics.viewport.actualWorldTilesVisible).toEqual(pixel32.diagnostics.viewport.actualWorldTilesVisible);
  expect(pixel16.diagnostics.viewport.actualWorldTilesVisible.width).toBeGreaterThanOrEqual(12);
  expect(pixel16.diagnostics.viewport.actualWorldTilesVisible.height).toBeGreaterThanOrEqual(10);
  expect(pixel16.diagnostics.candidateArt.candidateAssetIds).toEqual(expect.arrayContaining([
    'tile.grass', 'tile.field', 'tile.path', 'tile.tree', 'tile.wall', 'tile.fence',
  ]));
  expect(pixel16.diagnostics.pixel32Runtime.playerFrame).toBeNull();
  expect(pixel16.diagnostics.pixel32Runtime.playerVisible).toBe(false);
  expect(pixel32.diagnostics.pixel32Runtime.playerFrame).toBe('down-idle');
  expect(pixel32.diagnostics.pixel32Runtime.playerVisible).toBe(true);
  expect(pixel32.diagnostics.pixel32Runtime.animationFrames).toContain('down-idle');
  expect(pixel32.diagnostics.pixel32Runtime.mapFrames).toContain('spring-grass');
  expect(pixel32.diagnostics.pixel32Runtime.mapFrames).toContain('spring-field-edge-0');
  expect(pixel32.diagnostics.overlays.overlays.map(({ id, visible }) => ({ id, visible }))).toEqual([
    { id: 'house-back', visible: true },
    { id: 'tree-canopy', visible: true },
    { id: 'house-front', visible: true },
  ]);
  for (const capture of captures) {
    expect(capture.diagnostics.canvasCss.width).toBeGreaterThan(0);
    expect(capture.diagnostics.canvasCss.height).toBeGreaterThan(0);
    expect(capture.diagnostics.candidateSprites.length).toBeGreaterThan(0);
    expect(capture.diagnostics.cropFrames).toHaveLength(3);
    expect(capture.candidateRequests.length).toBeGreaterThan(0);
    expect(capture.candidateFailures).toEqual([]);
    expect(capture.candidateHttpFailures).toEqual([]);
    expect(capture.pageErrors).toEqual([]);
  }

  const manifestPath = path.resolve(nodeProcess?.cwd() ?? '.', candidateRoot, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
    status: string;
    approved: boolean;
    candidates: Array<{ id: string; status: string; approved: boolean }>;
  };
  expect(manifest.status).toBe('candidate');
  expect(manifest.approved).toBe(false);
  expect(manifest.candidates).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: '8bit', status: 'candidate', approved: false }),
    expect.objectContaining({ id: '16bit', status: 'candidate', approved: false }),
  ]));

  const sha256 = (bytes: Uint8Array) => crypto.createHash('sha256').update(bytes).digest('hex');
  const inputPaths = [
    candidateRoot + '/manifest.json',
    candidateRoot + '/8bit.png',
    candidateRoot + '/16bit.png',
    candidateRoot + '/pixel32-map/manifest.json',
    candidateRoot + '/pixel32-map/map-atlas.png',
    candidateRoot + '/pixel32-animation/manifest.json',
    candidateRoot + '/pixel32-animation/player-4dir.png',
  ];
  const pixel32MapManifest = JSON.parse(await fs.readFile(path.resolve(nodeProcess?.cwd() ?? '.', inputPaths[3]!), 'utf8')) as { status: string; approved: boolean };
  const pixel32AnimationManifest = JSON.parse(await fs.readFile(path.resolve(nodeProcess?.cwd() ?? '.', inputPaths[5]!), 'utf8')) as { status: string; approved: boolean };
  expect(pixel32MapManifest).toMatchObject({ status: 'candidate', approved: false });
  expect(pixel32AnimationManifest).toMatchObject({ status: 'candidate', approved: false });
  const inputs = Object.fromEntries(await Promise.all(inputPaths.map(async (relativePath) => [
    relativePath,
    sha256(await fs.readFile(path.resolve(nodeProcess?.cwd() ?? '.', relativePath))),
  ])));
  const evidence = {
    scope: 'Chromium candidate comparison only; partial asset coverage, not a complete art A/B or Gate 1 approval',
    viewport: { width: 1280, height: 900, deviceScaleFactor: 1 },
    fixture: { schemaVersion: 13, mapId: 'farm', player: { x: 5, y: 5 }, savedAt: farmSave.savedAt },
    fixtureSha256: sha256(new TextEncoder().encode(JSON.stringify(farmSave))),
    captures: captures.map(({ profile, candidate, diagnostics, candidateRequests, candidateFailures, candidateHttpFailures, pageErrors, screenshot }) => {
      const screenshotSha256 = sha256(screenshot);
      const screenshotPath = path.join(root, 'screenshots', profile + '-game.png');
      if (saveEvidence) return {
        profile, candidate, diagnostics, candidateRequests, candidateFailures, candidateHttpFailures, pageErrors,
        screenshotPath: path.relative(nodeProcess?.cwd() ?? '.', screenshotPath), screenshotSha256,
      };
      return { profile, candidate, diagnostics, candidateRequests, candidateFailures, candidateHttpFailures, pageErrors, screenshotSha256 };
    }),
    inputSha256: inputs,
    candidateStatus: {
      profileAtlas: { status: manifest.status, approved: manifest.approved, candidates: manifest.candidates.map(({ id, status, approved }) => ({ id, status, approved })) },
      pixel32Map: pixel32MapManifest,
      pixel32Animation: pixel32AnimationManifest,
    },
    limitations: [
      'Pixel16 candidate uses the 8-bit atlas scaled to the shared 64 px world tile; pixel32 uses its dedicated seasonal map and animation atlases.',
      'Pixel32-only house/tree overlays and full four-direction player animation do not have equivalent pixel16 candidate frames.',
    'Actual sprite sources are grouped by texture and frame; generic candidateArt resolver IDs do not by themselves represent the pixel32 runtime override coverage.',
      'Chromium CSS-scale screenshots do not establish native device appearance, art quality approval or Gate 1 completion.',
    ],
  };

  for (const capture of captures) {
    const imagePath = path.join(root, 'screenshots', capture.profile + '-game.png');
    await testInfo.attach(capture.profile + '-game.png', { body: capture.screenshot, contentType: 'image/png' });
    if (saveEvidence) await fs.writeFile(imagePath, capture.screenshot);
  }
  await testInfo.attach('gate1-pixel16-pixel32-scene-comparison.json', {
    body: JSON.stringify(evidence, null, 2),
    contentType: 'application/json',
  });
  if (saveEvidence) {
    await fs.writeFile(path.join(root, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  }
});
