import { expect, test, type Browser } from '@playwright/test';

const candidateQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation';
const evidenceRoot = 'docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-runtime';
const assetRoot = 'docs/art/candidates/pixel-movement/gate1-assets';
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
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_PIXEL32_RUNTIME_EVIDENCE === '1';

type CandidateManifest = {
  status: string;
  approved: boolean;
  atlas: { file: string };
};

type CaptureMeasurement = {
  viewport: { id: string; width: number; height: number };
  requestedDpr: number;
  browserDpr: number;
  mapId: string;
  runtimeEnabled: boolean;
  playerFrame: string | null;
  mapFrames: string[];
  animationFrames: string[];
  canvasCss: { x: number; y: number; width: number; height: number };
  canvasPixels: { width: number; height: number };
  renderResolution: { width: number; height: number };
  visibleTiles: { width: number; height: number };
  cameraZoom: number;
  screenshot: string;
  screenshotScale: 'css';
  sha256: string;
};

async function captureContext(browser: Browser, viewport: typeof viewports[number], dpr: number) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: dpr,
    isMobile: viewport.touch,
    hasTouch: viewport.touch,
  });
  const page = await context.newPage();
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
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().enabled ?? false)).toBe(true);
  return { context, page };
}

test('captures the DEV-only pixel32 MapScene candidate across five viewports and three DPR values', async ({ browser }, testInfo) => {
  test.setTimeout(10 * 60_000);
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const crypto = await import('node:' + 'crypto');
  const resolvePath = (repositoryPath: string): string => path.resolve(nodeProcess?.cwd() ?? '.', repositoryPath);
  const digest = (bytes: Uint8Array): string => crypto.createHash('sha256').update(bytes).digest('hex');
  const digestFile = async (repositoryPath: string): Promise<string> => digest(await fs.readFile(resolvePath(repositoryPath)));
  const loadCandidateManifest = async (repositoryPath: string, atlasName: string): Promise<CandidateManifest> => {
    const manifest = JSON.parse(await fs.readFile(resolvePath(repositoryPath), 'utf8')) as CandidateManifest;
    expect(manifest.status, `${repositoryPath} remains a candidate`).toBe('candidate');
    expect(manifest.approved, `${repositoryPath} remains unapproved`).toBe(false);
    expect(manifest.atlas.file).toBe(atlasName);
    return manifest;
  };
  const screenshotsDirectory = path.join(evidenceRoot, 'screenshots');
  if (saveEvidence) await fs.mkdir(resolvePath(screenshotsDirectory), { recursive: true });

  const mapManifest = await loadCandidateManifest(`${assetRoot}/pixel32-map/manifest.json`, 'map-atlas.png');
  const animationManifest = await loadCandidateManifest(`${assetRoot}/pixel32-animation/manifest.json`, 'player-4dir.png');
  const assets = {
    mapManifestSha256: await digestFile(`${assetRoot}/pixel32-map/manifest.json`),
    mapAtlasSha256: await digestFile(`${assetRoot}/pixel32-map/${mapManifest.atlas.file}`),
    animationManifestSha256: await digestFile(`${assetRoot}/pixel32-animation/manifest.json`),
    animationAtlasSha256: await digestFile(`${assetRoot}/pixel32-animation/${animationManifest.atlas.file}`),
  };
  const measurements: CaptureMeasurement[] = [];

  for (const viewport of viewports) {
    for (const dpr of dprs) {
      const { context, page } = await captureContext(browser, viewport, dpr);
      await expect.poll(() => page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
        return canvas?.getBoundingClientRect().width ?? 0;
      })).toBeGreaterThan(0);
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().playerFrame ?? '')).toBe('down-idle');

      const runtime = await page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
        const viewportInfo = window.__dewhollow?.pixelViewport();
        const candidate = window.__dewhollow?.pixel32CandidateRuntime();
        if (!canvas || !viewportInfo || !candidate) throw new Error('缺少候選 runtime 畫面診斷');
        const rect = canvas.getBoundingClientRect();
        return {
          mapId: window.__dewhollow?.mapId() ?? '',
          runtimeEnabled: candidate.enabled,
          playerFrame: candidate.playerFrame,
          mapFrames: candidate.mapFrames,
          animationFrames: candidate.animationFrames,
          browserDpr: window.devicePixelRatio,
          canvasCss: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          canvasPixels: { width: canvas.width, height: canvas.height },
          renderResolution: viewportInfo.renderResolution,
          visibleTiles: viewportInfo.actualWorldTilesVisible,
          cameraZoom: viewportInfo.cameraZoom,
        };
      });

      expect(runtime.mapId).toBe('farm');
      expect(runtime.runtimeEnabled).toBe(true);
      expect(runtime.browserDpr).toBe(dpr);
      expect(runtime.mapFrames).toContain('spring-grass');
      expect(runtime.mapFrames).toContain('spring-field-edge-f');
      expect(runtime.animationFrames).toContain('down-idle');
      expect(runtime.canvasPixels).toEqual(runtime.renderResolution);
      expect(runtime.canvasCss.width).toBeGreaterThan(0);
      expect(runtime.visibleTiles.width).toBeGreaterThan(0);
      expect(runtime.visibleTiles.height).toBeGreaterThan(0);
      expect(runtime.cameraZoom).toBeGreaterThan(0);

      await page.evaluate(() => window.__dewhollow?.pauseScene({ preservePose: false }));
      const filename = `${viewport.id}-dpr-${dpr}.png`;
      const screenshot = await page.screenshot({
        path: saveEvidence ? resolvePath(path.join(screenshotsDirectory, filename)) : undefined,
        animations: 'disabled',
        scale: 'css',
      });
      const screenshotHash = digest(screenshot);
      measurements.push({
        viewport: { id: viewport.id, width: viewport.width, height: viewport.height },
        requestedDpr: dpr,
        mapId: runtime.mapId,
        runtimeEnabled: runtime.runtimeEnabled,
        playerFrame: runtime.playerFrame,
        mapFrames: runtime.mapFrames,
        animationFrames: runtime.animationFrames,
        browserDpr: runtime.browserDpr,
        canvasCss: runtime.canvasCss,
        canvasPixels: runtime.canvasPixels,
        renderResolution: runtime.renderResolution,
        visibleTiles: runtime.visibleTiles,
        cameraZoom: runtime.cameraZoom,
        screenshot: `screenshots/${filename}`,
        screenshotScale: 'css',
        sha256: screenshotHash,
      });
      await testInfo.attach(filename, { body: screenshot, contentType: 'image/png' });
      await context.close();
    }
  }

  expect(measurements).toHaveLength(viewports.length * dprs.length);
  const matrix = {
    schemaVersion: 1,
    generatedBy: 'tests/e2e/gate1-mapscene-pixel32-candidate-evidence.spec.ts',
    evidenceMode: saveEvidence ? 'saved-to-repository' : 'playwright-attachments',
    candidate: {
      map: { status: mapManifest.status, approved: mapManifest.approved },
      animation: { status: animationManifest.status, approved: animationManifest.approved },
      assets,
    },
    claim: '15 Chromium-emulated captures of the same DEV-only pixel32 candidate farm MapScene. Screenshots are CSS-scale output with reported browser DPR; this does not establish native-device behavior, complete-art coverage, asset approval, or Gate 1 completion.',
    viewports,
    dprs,
    measurements,
  };
  const body = `${JSON.stringify(matrix, null, 2)}\n`;
  if (saveEvidence) await fs.writeFile(resolvePath(path.join(evidenceRoot, 'matrix.json')), body);
  await testInfo.attach('gate1-pixel32-candidate-matrix.json', { body, contentType: 'application/json' });
});
