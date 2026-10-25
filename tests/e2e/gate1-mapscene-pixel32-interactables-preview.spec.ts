import { expect, test } from '@playwright/test';

const runtimeQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation';
const interactablesQuery = `${runtimeQuery}&gate1InteractablePreview=pixel32-interactables`;
const interactablesRoot = '/docs/art/candidates/pixel-movement/gate1-assets/pixel32-interactables';
const interactablesPaths = [`${interactablesRoot}/manifest.json`, `${interactablesRoot}/interactables-atlas.png`];
const evidenceRoot = 'docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-interactables-preview';
const nodeProcess = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process;
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_INTERACTABLES_EVIDENCE === '1';

test('previews unapproved door and shipbox states only on the exact DEV route', async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const crypto = await import('node:' + 'crypto');
  const repositoryPath = path.resolve(nodeProcess?.cwd() ?? '.');
  const evidenceDirectory = path.join(repositoryPath, evidenceRoot);
  if (saveEvidence) await fs.mkdir(path.join(evidenceDirectory, 'screenshots'), { recursive: true });

  const manifestBytes = await fs.readFile(path.join(repositoryPath, interactablesRoot.slice(1), 'manifest.json'));
  const atlasBytes = await fs.readFile(path.join(repositoryPath, interactablesRoot.slice(1), 'interactables-atlas.png'));
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as {
    status: string;
    approved: boolean;
    atlas: { sha256: string };
    frames: Record<string, { approved: boolean; sha256: string }>;
  };
  const sha256 = (bytes: Uint8Array) => crypto.createHash('sha256').update(bytes).digest('hex');
  const inputHashes = {
    manifestSha256: sha256(manifestBytes),
    atlasSha256: sha256(atlasBytes),
    frameSha256: Object.fromEntries(['door-closed', 'door-open', 'shipbox-closed', 'shipbox-open'].map((frame) => [frame, manifest.frames[frame]?.sha256])),
  };
  expect(manifest).toMatchObject({ status: 'candidate', approved: false, atlas: { sha256: inputHashes.atlasSha256 } });
  expect(Object.values(manifest.frames).every(({ approved }) => approved === false)).toBe(true);

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const requests: string[] = [];
  const failures: string[] = [];
  const httpFailures: string[] = [];
  const pageErrors: string[] = [];
  page.on('request', (request) => {
    if (interactablesPaths.some((candidatePath) => request.url().includes(candidatePath))) requests.push(new URL(request.url()).pathname);
  });
  page.on('requestfailed', (request) => {
    if (interactablesPaths.some((candidatePath) => request.url().includes(candidatePath))) failures.push(request.url());
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && interactablesPaths.some((candidatePath) => response.url().includes(candidatePath))) {
      httpFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(runtimeQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateInteractables().enabled ?? false)).toBe(false);
  expect(requests).toEqual([]);

  await page.goto(interactablesQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateInteractables().items.length ?? 0)).toBe(4);
  const initial = await page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('Missing DEV diagnostics');
    return {
      preview: debug.pixel32CandidateInteractables(),
      movement: debug.movement(),
      interaction: debug.interaction(),
      interactionTarget: debug.interactionTargetMarker(),
      mapId: debug.mapId(),
      energy: document.querySelector('#hud-energy-text')?.textContent ?? null,
    };
  });
  expect(initial.preview).toMatchObject({ enabled: true, status: 'candidate', approved: false });
  expect(initial.preview.items.map(({ id, frame, tileX, tileY, visible }) => ({ id, frame, tileX, tileY, visible }))).toEqual([
    { id: 'door-closed', frame: 'door-closed', tileX: 2, tileY: 4, visible: true },
    { id: 'door-open', frame: 'door-open', tileX: 4, tileY: 4, visible: true },
    { id: 'shipbox-closed', frame: 'shipbox-closed', tileX: 2, tileY: 7, visible: true },
    { id: 'shipbox-open', frame: 'shipbox-open', tileX: 4, tileY: 7, visible: true },
  ]);
  expect(requests).toEqual(expect.arrayContaining(interactablesPaths));
  expect(failures).toEqual([]);
  expect(httpFailures).toEqual([]);
  expect(pageErrors).toEqual([]);

  expect(await page.evaluate(() => window.__dewhollow!.setCandidateInteractableFrame('door-closed', 'door-open'))).toBe(true);
  expect(await page.evaluate(() => window.__dewhollow!.setCandidateInteractableFrame('door-closed', 'shipbox-open'))).toBe(false);
  const switched = await page.evaluate(() => {
    const debug = window.__dewhollow!;
    return {
      preview: debug.pixel32CandidateInteractables(),
      movement: debug.movement(),
      interaction: debug.interaction(),
      interactionTarget: debug.interactionTargetMarker(),
      mapId: debug.mapId(),
      energy: document.querySelector('#hud-energy-text')?.textContent ?? null,
    };
  });
  expect(switched.preview.items.find(({ id }) => id === 'door-closed')?.frame).toBe('door-open');
  expect(switched).toMatchObject({ movement: initial.movement, interaction: initial.interaction, interactionTarget: initial.interactionTarget, mapId: initial.mapId, energy: initial.energy });
  expect(await page.evaluate(() => window.__dewhollow!.setCandidateInteractableFrame('door-closed', 'door-closed'))).toBe(true);

  const screenshot = await page.screenshot({ animations: 'disabled', scale: 'css' });
  await testInfo.attach('pixel32-interactables-preview-1280x900.png', { body: screenshot, contentType: 'image/png' });
  if (saveEvidence) {
    await fs.writeFile(path.join(evidenceDirectory, 'screenshots', 'pixel32-interactables-preview.png'), screenshot);
    const evidence = {
      schemaVersion: 1,
      status: 'candidate',
      approved: false,
      scope: 'DEV farm MapScene visual preview only; no interaction, collision, transport, inventory, or save behavior changes',
      viewport: { width: 1280, height: 900, deviceScaleFactor: 1 },
      inputHashes,
      requestPaths: [...new Set(requests)].sort(),
      preview: initial.preview,
      testOnlySwitch: { from: 'door-closed', to: 'door-open', rejectedCrossFamilyFrame: 'shipbox-open', runtimeStateUnchanged: true },
      requestsFailed: failures,
      httpFailures,
      pageErrors,
      screenshotSha256: sha256(screenshot),
    };
    await fs.writeFile(path.join(evidenceDirectory, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  }

  await context.close();

  const productionContext = await browser.newContext();
  const productionPage = await productionContext.newPage();
  const productionRequests: string[] = [];
  productionPage.on('request', (request) => {
    if (interactablesPaths.some((candidatePath) => request.url().includes(candidatePath))) productionRequests.push(request.url());
  });
  const baseUrl = nodeProcess?.env?.PWA_BASE_URL ?? 'http://127.0.0.1:4173';
  await productionPage.goto(`${baseUrl}/${interactablesQuery}`);
  await expect(productionPage.locator('#game canvas')).toBeVisible();
  expect(productionRequests).toEqual([]);
  expect(await productionPage.evaluate(() => window.__dewhollow?.pixel32CandidateInteractables?.().enabled ?? false)).toBe(false);
  await productionContext.close();
});
