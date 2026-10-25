import { expect, test, type Page } from '@playwright/test';

const candidateRoot = '/docs/art/candidates/pixel-movement/gate1-pets-pixel32';
const reviewQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1AssetPreview=pixel32-candidates';
const followQuery = `${reviewQuery}&gate1CandidatePetFollow=pixel32-cat-follow`;
const evidenceRoot = 'docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-pet-follow';
const nodeProcess = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process;
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_PIXEL32_PET_FOLLOW_EVIDENCE === '1';

async function seedFarmSave(page: Page): Promise<void> {
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
          mapId: 'farm', player: { x: 5, y: 5, facing: 'up' }, plots: {},
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
}

async function waitForPlayerIdle(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    return movement !== undefined && movement.heldDirection === null && !movement.moving
      && !movement.pending && movement.queuedTaps === 0;
  })).toBe(true);
}

test('pixel32 candidate cat follows the production trail with four directional hop sequences', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const crypto = await import('node:' + 'crypto');
  const root = path.resolve(nodeProcess?.cwd() ?? '.', evidenceRoot);
  if (saveEvidence) await fs.mkdir(path.join(root, 'screenshots'), { recursive: true });

  const candidatePaths = [`${candidateRoot}/manifest.json`, `${candidateRoot}/pets-pixel32.png`];
  const candidateRequests: string[] = [];
  const candidateFailures: string[] = [];
  const candidateHttpFailures: string[] = [];
  const pageErrors: string[] = [];
  page.on('request', (request) => {
    if (candidatePaths.some((file) => request.url().includes(file))) candidateRequests.push(new URL(request.url()).pathname);
  });
  page.on('requestfailed', (request) => {
    if (candidatePaths.some((file) => request.url().includes(file))) candidateFailures.push(request.url());
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && candidatePaths.some((file) => response.url().includes(file))) {
      candidateHttpFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(followQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().enabled ?? false)).toBe(true);
  await seedFarmSave(page);
  await page.reload();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.candidatePetFollow().enabled ?? false)).toBe(true);
  await page.evaluate(() => window.__dewhollow?.setCandidateAssetReviewVisible(false));

  const initial = await page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('Missing DEV candidate diagnostics');
    return { pet: debug.candidatePetFollow(), player: debug.movement().tile };
  });
  expect(initial.pet.manifest).toEqual({ status: 'candidate', approved: false });
  expect(initial.pet.cat).toMatchObject({ direction: 'up', frame: 'cat-up-idle', visible: true, tile: { x: 5, y: 6 } });

  const directions: Array<{ key: string; direction: 'up' | 'right' | 'down' | 'left'; target: { x: number; y: number } }> = [
    { key: 'ArrowRight', direction: 'up', target: { x: 5, y: 5 } },
    { key: 'ArrowDown', direction: 'right', target: { x: 6, y: 5 } },
    { key: 'ArrowLeft', direction: 'down', target: { x: 6, y: 6 } },
    { key: 'ArrowUp', direction: 'left', target: { x: 5, y: 6 } },
  ];
  const records: Array<Record<string, unknown>> = [];
  const screenshots: Array<{ direction: string; file: string; sha256: string }> = [];
  for (const [index, step] of directions.entries()) {
    await waitForPlayerIdle(page);
    const playerBefore = await page.evaluate(() => window.__dewhollow!.movement().tile);
    await page.evaluate(() => {
      const captureWindow = window as typeof window & {
        __candidatePetFrameCapture?: { active: boolean; frames: string[]; last: string | null };
      };
      const capture = { active: true, frames: [] as string[], last: null as string | null };
      captureWindow.__candidatePetFrameCapture = capture;
      const sample = (): void => {
        if (!capture.active) return;
        const frame = window.__dewhollow?.candidatePetFollow().cat?.frame ?? null;
        if (frame && frame !== capture.last) {
          capture.frames.push(frame);
          capture.last = frame;
          if (capture.frames.includes(frame.replace(/-(?:hop-a|hop-b|land|idle)$/, '-land'))
            && frame.endsWith('-idle')) capture.active = false;
        }
        if (capture.active) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.keyboard.press(step.key);
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().tile)).not.toEqual(playerBefore);
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.candidatePetFollow().cat?.tile ?? null)).toEqual(step.target);
    await expect.poll(() => page.evaluate(() => {
      const capture = (window as typeof window & { __candidatePetFrameCapture?: { active: boolean; frames: string[] } }).__candidatePetFrameCapture;
      return capture?.active === false && capture.frames.some((frame) => frame.endsWith('-land'));
    }), { timeout: 5_000 }).toBe(true);
    const capture = await page.evaluate(() => {
      const pet = window.__dewhollow!.candidatePetFollow().cat!;
      const frames = (window as typeof window & { __candidatePetFrameCapture?: { frames: string[] } }).__candidatePetFrameCapture?.frames ?? [];
      return { pet, frames };
    });
    const expectedFrames = [`cat-${step.direction}-hop-a`, `cat-${step.direction}-hop-b`, `cat-${step.direction}-land`, `cat-${step.direction}-idle`];
    expect(capture.frames.slice(-4)).toEqual(expectedFrames);
    expect(capture.pet.visible).toBe(true);
    expect(capture.pet.bounds.width).toBe(64);
    expect(capture.pet.bounds.height).toBe(64);
    expect(capture.pet.depth).toBeGreaterThan(10);
    const screenshotPath = path.join(root, 'screenshots', `${String(index + 1).padStart(2, '0')}-${step.direction}-follow.png`);
    const screenshot = await page.screenshot({ path: saveEvidence ? screenshotPath : undefined, animations: 'disabled' });
    await testInfo.attach(`${step.direction}-hop-b`, { body: screenshot, contentType: 'image/png' });
    screenshots.push({ direction: step.direction, file: path.relative(root, screenshotPath), sha256: crypto.createHash('sha256').update(screenshot).digest('hex') });
    await waitForPlayerIdle(page);
    const pet = await page.evaluate(() => window.__dewhollow!.candidatePetFollow().cat!);
    records.push({ playerBefore, playerAfter: await page.evaluate(() => window.__dewhollow!.movement().tile), pet, frames: capture.frames });
  }

  expect(candidateRequests).toEqual(expect.arrayContaining(candidatePaths));
  expect(candidateFailures).toEqual([]);
  expect(candidateHttpFailures).toEqual([]);
  expect(pageErrors).toEqual([]);
  const manifestPath = path.resolve(nodeProcess?.cwd() ?? '.', candidateRoot.slice(1), 'manifest.json');
  const manifestBytes = await fs.readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as { status: string; approved: boolean; atlas: { file: string }; frames: Record<string, { sha256?: string }> };
  const atlasPath = path.join(path.dirname(manifestPath), manifest.atlas.file);
  const sha256 = (bytes: Uint8Array) => crypto.createHash('sha256').update(bytes).digest('hex');
  const sourcePaths = ['src/presentation/scenes/MapScene.ts', 'src/presentation/pixel32-candidate-runtime.ts'];
  const sourceHashes = Object.fromEntries(await Promise.all(sourcePaths.map(async (source) => [source, sha256(await fs.readFile(source))])));
  const evidence = {
    schemaVersion: 1,
    scope: 'DEV-only opt-in candidate pet visual; no production asset integration or Gate 1 approval',
    route: followQuery,
    baseRevision: (await (await import('node:' + 'child_process')).execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' })).trim(),
    sourceHashes,
    candidate: { status: manifest.status, approved: manifest.approved, manifestSha256: sha256(manifestBytes), atlasSha256: sha256(await fs.readFile(atlasPath)), frameHashes: Object.fromEntries(Object.entries(manifest.frames).filter(([name]) => name.startsWith('cat-')).map(([name, frame]) => [name, frame.sha256 ?? null])) },
    initial,
    movements: records,
    screenshots,
    candidateRequests,
    candidateFailures,
    candidateHttpFailures,
    pageErrors,
    limitations: ['The cat visual alone uses candidate frames; movement targets, 110 ms root motion, trail occupancy, depth ordering, and save behavior remain existing production behavior.', 'The manifest and asset remain candidate and unapproved.', 'Evidence covers desktop Chromium only; no device performance or art approval is implied.'],
  };
  if (saveEvidence) await fs.writeFile(path.join(root, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  expect(manifest).toMatchObject({ status: 'candidate', approved: false, atlas: { file: 'pets-pixel32.png' } });
});

test('candidate cat visual stays disabled without the exact pet-follow opt-in', async ({ page }) => {
  await page.goto(reviewQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.candidateAssetReview().enabled ?? false)).toBe(true);
  const state = await page.evaluate(() => ({
    pet: window.__dewhollow!.candidatePetFollow(),
    actor: window.__dewhollow!.actors().find((actor) => actor.id === 'cat'),
    limitations: window.__dewhollow!.candidateAssetReview().limitations,
  }));
  expect(state.pet).toMatchObject({ enabled: false, manifest: { status: null, approved: null }, cat: null });
  expect(state.actor).toBeDefined();
  expect(state.limitations).toContain('Pet frames are static directional samples; movement and follow animation remain production behavior.');
});
