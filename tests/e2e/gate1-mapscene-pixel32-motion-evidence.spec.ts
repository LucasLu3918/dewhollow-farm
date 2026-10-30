import { expect, test, type Browser, type Page } from '@playwright/test';

const candidateQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation';
const evidenceRoot = 'docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-motion-evidence';
const nodeProcess = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process;
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_PIXEL32_MOTION_EVIDENCE === '1';
const fourDirections = [
  { key: 'ArrowRight', id: 'right', axis: 'x', delta: 1 },
  { key: 'ArrowDown', id: 'down', axis: 'y', delta: 1 },
  { key: 'ArrowLeft', id: 'left', axis: 'x', delta: -1 },
  { key: 'ArrowUp', id: 'up', axis: 'y', delta: -1 },
] as const;

type Tile = { x: number; y: number };
type DirectionSample = { frame: string; tile: Tile; moving: boolean; heldDirection: string | null };

async function startCandidateFarm(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
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

async function waitForMovementIdle(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    return movement !== undefined
      && movement.heldDirection === null
      && !movement.moving
      && !movement.pending
      && movement.queuedTaps === 0;
  }), { timeout: 10_000 }).toBe(true);
}

async function sampleHeldDirection(
  page: Page,
  direction: string,
  durationMs: number,
  captureFrame: boolean,
): Promise<{ samples: DirectionSample[]; screenshotDataUrl: string | null }> {
  return page.evaluate(async ({ expectedDirection, duration, captureFrame }) => {
    const samples: DirectionSample[] = [];
    const startedAt = performance.now();
    while (performance.now() - startedAt < duration) {
      const movement = window.__dewhollow?.movement();
      const runtime = window.__dewhollow?.pixel32CandidateRuntime();
      if (movement && runtime) {
        samples.push({
          frame: runtime.playerFrame ?? '',
          tile: movement.tile,
          moving: movement.moving,
          heldDirection: movement.heldDirection,
        });
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    if (!samples.some((sample) => sample.heldDirection === expectedDirection)) {
      throw new Error(`No held ${expectedDirection} input was observed`);
    }
    const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
    if (captureFrame && !canvas) throw new Error('Game canvas was unavailable for the held-direction screenshot');
    return { samples, screenshotDataUrl: captureFrame ? canvas!.toDataURL('image/png') : null };
  }, { expectedDirection: direction, duration: durationMs, captureFrame });
}

test('pixel32 candidate MapScene shows five seconds of four-direction movement and stops at a wall', async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const crypto = await import('node:' + 'crypto');
  const { Buffer } = await import('node:' + 'buffer');
  const root = path.resolve(nodeProcess?.cwd() ?? '.', evidenceRoot);
  if (saveEvidence) await fs.mkdir(root, { recursive: true });

  const { context, page } = await startCandidateFarm(browser);
  const initial = await page.evaluate(() => window.__dewhollow!.movement().tile);
  expect(initial).toMatchObject({ x: 20, y: 14 });

  const beforeWall = await page.evaluate(() => window.__dewhollow!.movement().tile);
  await page.keyboard.down('ArrowLeft');
  // The new central avenue reaches the west boundary along y=14.
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().tile.x), { timeout: 10_000 }).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().blockedDirection ?? null), { timeout: 10_000 }).toBe('left');
  const wallTile = await page.evaluate(() => window.__dewhollow!.movement().tile);
  expect(wallTile.y).toBe(14);
  expect(wallTile.x).toBe(1);
  expect(wallTile.x).toBeLessThan(beforeWall.x);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__dewhollow!.movement().tile)).toEqual(wallTile);
  await page.keyboard.up('ArrowLeft');
  await waitForMovementIdle(page);
  const wallScreenshot = await page.screenshot({ animations: 'disabled', scale: 'css' });
  await testInfo.attach('pixel32-candidate-wall-stop.png', { body: wallScreenshot, contentType: 'image/png' });

  for (let x = wallTile.x; x < initial.x; x += 1) {
    const previous = await page.evaluate(() => window.__dewhollow!.movement().tile);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => page.evaluate(() => window.__dewhollow!.movement().tile.x), { timeout: 10_000 }).toBe(previous.x + 1);
    await waitForMovementIdle(page);
  }
  expect(await page.evaluate(() => window.__dewhollow!.movement().tile)).toMatchObject({ x: initial.x, y: initial.y });

  const segmentDurationMs = 1_250;
  const directionEvidence: Record<string, { elapsedMs: number; minimumHeldMs: number; tilesMoved: number; animatedFrames: string[]; sampleCount: number }> = {};
  const directionScreenshots: Record<string, Uint8Array> = {};
  const movementStartedAt = Date.now();
  for (const direction of fourDirections) {
    const before = await page.evaluate(() => window.__dewhollow!.movement().tile);
    await page.keyboard.down(direction.key);
    const heldStartedAt = Date.now();
    const capture = await sampleHeldDirection(page, direction.id, segmentDurationMs, saveEvidence);
    const samples = capture.samples;
    if (capture.screenshotDataUrl) {
      directionScreenshots[direction.id] = Buffer.from(capture.screenshotDataUrl.split(',')[1] ?? '', 'base64');
      await testInfo.attach(`pixel32-candidate-${direction.id}-held.png`, {
        body: directionScreenshots[direction.id],
        contentType: 'image/png',
      });
    }
    await page.keyboard.up(direction.key);
    const elapsedMs = Date.now() - heldStartedAt;
    const after = await page.evaluate(() => window.__dewhollow!.movement().tile);
    const moved = Math.abs(after[direction.axis] - before[direction.axis]);
    const animatedFrames = [...new Set(samples.map(({ frame }) => frame))]
      .filter((frame) => frame.startsWith(`${direction.id}-`) && !frame.endsWith('-idle'));
    expect(moved, `${direction.id} held input should move along its axis`).toBeGreaterThanOrEqual(4);
    expect(after[direction.axis === 'x' ? 'y' : 'x']).toBe(before[direction.axis === 'x' ? 'y' : 'x']);
    expect(animatedFrames, `${direction.id} candidate walk frames should render`).not.toHaveLength(0);
    directionEvidence[direction.id] = {
      elapsedMs,
      minimumHeldMs: segmentDurationMs,
      tilesMoved: moved,
      animatedFrames,
      sampleCount: samples.length,
    };
  }
  await waitForMovementIdle(page);
  const totalObservedSequenceMs = Date.now() - movementStartedAt;
  const totalHeldInputMs = Object.values(directionEvidence).reduce((total, item) => total + item.elapsedMs, 0);
  expect(totalHeldInputMs).toBeGreaterThanOrEqual(5_000);
  expect(totalObservedSequenceMs).toBeGreaterThanOrEqual(totalHeldInputMs);

  const finalScreenshot = await page.screenshot({ animations: 'disabled', scale: 'css' });
  await testInfo.attach('pixel32-candidate-four-direction-final.png', { body: finalScreenshot, contentType: 'image/png' });
  await context.close();

  const evidence = {
    schemaVersion: 1,
    candidate: { route: candidateQuery, status: 'candidate', approved: false },
    viewport: { width: 1280, height: 720, dpr: 1 },
    initialTile: initial,
    collision: {
      heldDirection: 'left',
      tileBefore: beforeWall,
      blockedTile: wallTile,
      stayedInPlaceForMs: 250,
      boundary: 'farm x=0 is a wall; player remains on a traversable tile',
    },
    fourDirectionMovement: directionEvidence,
    totalHeldInputMs,
    totalObservedSequenceMs,
    claim: 'DEV-only Chromium evidence for the existing farm MapScene. This does not establish native-device behavior, formal asset approval, complete scene art, or Gate 1 completion.',
  };
  if (saveEvidence) {
    const screenshotNames = [
      ...fourDirections.map(({ id }) => {
        const bytes = directionScreenshots[id];
        if (!bytes) throw new Error(`Missing held-direction screenshot for ${id}`);
        return [`${id}.png`, bytes] as const;
      }),
      ['wall-stop.png', wallScreenshot],
      ['four-direction-final.png', finalScreenshot],
    ] as const;
    for (const [filename, bytes] of screenshotNames) await fs.writeFile(path.join(root, filename), bytes);
    Object.assign(evidence, {
      screenshots: Object.fromEntries(await Promise.all(screenshotNames.map(async ([filename, bytes]) => [
        filename,
        { sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.byteLength },
      ]))),
    });
  }
  const reportBody = `${JSON.stringify(evidence, null, 2)}\n`;
  await testInfo.attach('pixel32-candidate-motion-evidence.json', { body: reportBody, contentType: 'application/json' });
  if (saveEvidence) await fs.writeFile(path.join(root, 'evidence.json'), reportBody);
});
