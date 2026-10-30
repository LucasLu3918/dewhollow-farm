import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

const candidateQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation';
const directions = [
  { name: 'right', key: 'ArrowRight', dx: 1, dy: 0 },
  { name: 'down', key: 'ArrowDown', dx: 0, dy: 1 },
  { name: 'left', key: 'ArrowLeft', dx: -1, dy: 0 },
  { name: 'up', key: 'ArrowUp', dx: 0, dy: -1 },
] as const;

type Direction = typeof directions[number]['name'];
type Tile = { x: number; y: number };

async function startCandidateFarm(browser: Browser): Promise<{ context: Awaited<ReturnType<Browser['newContext']>>; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(candidateQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().enabled ?? false)).toBe(true);
  return { context, page };
}

async function readState(page: Page): Promise<{ tile: Tile; facing: Direction; moving: boolean; pending: boolean; heldDirection: string | null; queuedTaps: number }> {
  return page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    const playerFrame = window.__dewhollow?.pixel32CandidateRuntime().playerFrame ?? '';
    if (!movement || !playerFrame.endsWith('-idle')) throw new Error('pixel32 候選 farm movement diagnostics unavailable');
    return {
      tile: { x: movement.tile.x, y: movement.tile.y },
      facing: playerFrame.slice(0, -'-idle'.length) as Direction,
      moving: movement.moving,
      pending: movement.pending,
      heldDirection: movement.heldDirection,
      queuedTaps: movement.queuedTaps,
    };
  });
}

async function pressOneTile(page: Page, direction: typeof directions[number]): Promise<{ before: Tile; after: Tile; facing: Direction }> {
  const initial = await readState(page);
  expect(initial.moving || initial.pending || initial.heldDirection !== null || initial.queuedTaps !== 0).toBe(false);
  const expected = { x: initial.tile.x + direction.dx, y: initial.tile.y + direction.dy };

  await page.keyboard.press(direction.key);
  await page.waitForFunction(({ x, y, facing }) => {
    const movement = window.__dewhollow?.movement();
    const playerFrame = window.__dewhollow?.pixel32CandidateRuntime().playerFrame ?? '';
    return movement?.tile.x === x
      && movement.tile.y === y
      && playerFrame === `${facing}-idle`
      && !movement.moving
      && !movement.pending
      && movement.heldDirection === null
      && movement.queuedTaps === 0;
  }, { ...expected, facing: direction.name }, { timeout: 5_000 });

  const final = await readState(page);
  expect(final.tile).toEqual(expected);
  expect(final.facing).toBe(direction.name);
  expect(Math.abs(final.tile.x - initial.tile.x) + Math.abs(final.tile.y - initial.tile.y)).toBe(1);
  return { before: initial.tile, after: final.tile, facing: final.facing };
}

async function saveEvidence(testInfo: TestInfo, data: Record<string, unknown>, screenshots: { start: Uint8Array; stopped: Uint8Array }): Promise<void> {
  await testInfo.attach('pixel32-short-press-100-evidence.json', {
    body: JSON.stringify(data, null, 2),
    contentType: 'application/json',
  });
  await testInfo.attach('pixel32-short-press-100-start.png', { body: screenshots.start, contentType: 'image/png' });
  await testInfo.attach('pixel32-short-press-100-stopped.png', { body: screenshots.stopped, contentType: 'image/png' });

  const runtime = globalThis as typeof globalThis & { process?: { cwd?: () => string; env?: Record<string, string | undefined> } };
  if (runtime.process?.env?.['SAVE_GATE1_EVIDENCE'] !== '1') return;
  const fs = await import('node:' + 'fs/promises');
  const nodePath = await import('node:' + 'path');
  const evidenceDirectory = nodePath.join(runtime.process.cwd?.() ?? '.', 'docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-short-press-100');
  await fs.mkdir(nodePath.join(evidenceDirectory, 'screenshots'), { recursive: true });
  await fs.writeFile(nodePath.join(evidenceDirectory, 'evidence.json'), JSON.stringify(data, null, 2) + '\n');
  await fs.writeFile(nodePath.join(evidenceDirectory, 'screenshots', 'short-press-start-390x844.png'), screenshots.start);
  await fs.writeFile(nodePath.join(evidenceDirectory, 'screenshots', 'short-press-stopped-390x844.png'), screenshots.stopped);
}

test('pixel32 candidate accepts 100 exact one-tile short presses in every direction', async ({ browser }, testInfo) => {
  test.setTimeout(240_000);
  const { context, page } = await startCandidateFarm(browser);
  const startState = await readState(page);
  const startScreenshot = await page.screenshot({ animations: 'disabled', scale: 'css' });
  const presses: Array<{ index: number; cycle: number; direction: Direction; before: Tile; after: Tile; facing: Direction }> = [];
  const counts: Record<Direction, number> = { right: 0, down: 0, left: 0, up: 0 };

  try {
    // This four-tile rectangle stays in open farm grass/path and returns to its
    // origin each cycle: 100 taps per direction without touching a boundary.
    expect(startState.tile).toEqual({ x: 20, y: 14 });
    for (let cycle = 1; cycle <= 100; cycle += 1) {
      for (const direction of directions) {
        const step = await pressOneTile(page, direction);
        counts[direction.name] += 1;
        presses.push({ index: presses.length + 1, cycle, direction: direction.name, ...step });
      }
      expect((await readState(page)).tile).toEqual(startState.tile);
    }

    expect(counts).toEqual({ right: 100, down: 100, left: 100, up: 100 });

    // Separately prove wall rejection after the measured 400 short presses.
    for (let step = 0; step < 19; step += 1) await pressOneTile(page, directions[2]);
    const wallBefore = await readState(page);
    expect(wallBefore.tile).toEqual({ x: 1, y: 14 });
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(({ x, y }) => {
      const movement = window.__dewhollow?.movement();
      return movement?.tile.x === x
        && movement.tile.y === y
        && movement.blockedDirection === 'left'
        && !movement.moving;
    }, wallBefore.tile, { timeout: 5_000 });
    const blockedAtWall = await readState(page);
    expect(blockedAtWall.tile).toEqual(wallBefore.tile);
    await page.keyboard.up('ArrowLeft');
    await page.waitForFunction(() => {
      const movement = window.__dewhollow?.movement();
      const playerFrame = window.__dewhollow?.pixel32CandidateRuntime().playerFrame ?? '';
      return movement?.heldDirection === null
        && !movement.moving
        && !movement.pending
        && movement.queuedTaps === 0
        && playerFrame === 'left-idle';
    }, undefined, { timeout: 5_000 });
    const wallAfter = await readState(page);
    expect(wallAfter.tile).toEqual(wallBefore.tile);
    const stoppedScreenshot = await page.screenshot({ animations: 'disabled', scale: 'css' });

    const runtime = globalThis as typeof globalThis & { process?: { cwd?: () => string } };
    const crypto = await import('node:' + 'crypto');
    const fs = await import('node:' + 'fs/promises');
    const nodePath = await import('node:' + 'path');
    const source = await fs.readFile(nodePath.join(runtime.process?.cwd?.() ?? '.', 'tests/e2e/gate1-mapscene-pixel32-short-press-100.spec.ts'));
    const evidence = {
      schemaVersion: 1,
      title: 'DF-G1-SHORT-PRESS-100',
      scope: 'isolated DEV-only pixel32 candidate MapScene; no runtime, formal asset, map, save, or approval changes',
      generatedAt: new Date().toISOString(),
      viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
      start: startState,
      measuredPressCounts: counts,
      totalMeasuredShortPresses: presses.length,
      measuredPresses: presses,
      loopInvariant: 'Each R-D-L-U cycle ends at the same tile; each key press commits exactly one cardinal adjacent tile and leaves facing in that direction.',
      boundary: { before: wallBefore, direction: 'left', blocked: blockedAtWall, after: wallAfter, coordinateUnchanged: wallAfter.tile.x === wallBefore.tile.x && wallAfter.tile.y === wallBefore.tile.y },
      sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
      screenshots: {
        start: { path: 'screenshots/short-press-start-390x844.png', sha256: crypto.createHash('sha256').update(startScreenshot).digest('hex'), bytes: startScreenshot.byteLength },
        stopped: { path: 'screenshots/short-press-stopped-390x844.png', sha256: crypto.createHash('sha256').update(stoppedScreenshot).digest('hex'), bytes: stoppedScreenshot.byteLength },
      },
      limitations: ['Synthetic Chromium keyboard input only; no native-device latency or FPS claim.', 'Candidate evidence only; does not approve art or complete Gate 1.'],
    };
    await saveEvidence(testInfo, evidence, { start: startScreenshot, stopped: stoppedScreenshot });
  } finally {
    await context.close();
  }
});
