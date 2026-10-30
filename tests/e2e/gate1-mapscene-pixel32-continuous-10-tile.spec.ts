import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

const candidateQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation';
const directions = [
  { name: 'right', key: 'ArrowRight', dx: 1, dy: 0 },
  { name: 'down', key: 'ArrowDown', dx: 0, dy: 1 },
  { name: 'left', key: 'ArrowLeft', dx: -1, dy: 0 },
  { name: 'up', key: 'ArrowUp', dx: 0, dy: -1 },
] as const;
const evidenceRoot = 'docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-continuous-10-tile';
const nodeProcess = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process;
const persistEvidence = nodeProcess?.env?.['SAVE_GATE1_CONTINUOUS_10_TILE_EVIDENCE'] === '1';

type Tile = { x: number; y: number };

async function startCandidateFarm(browser: Browser): Promise<{ context: Awaited<ReturnType<Browser['newContext']>>; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(candidateQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().enabled ?? false)).toBe(true);
  return { context, page };
}

async function waitForIdle(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    return movement !== undefined && !movement.moving && !movement.pending
      && movement.heldDirection === null && movement.queuedTaps === 0;
  })).toBe(true);
}

async function pressOneTile(page: Page, key: string, dx: number, dy: number): Promise<void> {
  await waitForIdle(page);
  const before = await page.evaluate(() => window.__dewhollow!.movement().tile);
  await page.keyboard.press(key);
  await page.waitForFunction(({ x, y }) => {
    const movement = window.__dewhollow?.movement();
    return movement?.tile.x === x && movement.tile.y === y
      && !movement.moving && !movement.pending
      && movement.heldDirection === null && movement.queuedTaps === 0;
  }, { x: before.x + dx, y: before.y + dy }, { timeout: 5_000 });
}

async function moveToOpenCenter(page: Page): Promise<void> {
  // The redesigned farm spawn is (20,14); move into a clear corridor with ten
  // walkable tiles available in every cardinal direction.
  for (let step = 0; step < 2; step += 1) await pressOneTile(page, 'ArrowUp', 0, -1);
  const center = await page.evaluate(() => window.__dewhollow!.movement().tile);
  expect({ x: center.x, y: center.y }).toEqual({ x: 20, y: 12 });
}

async function installCollector(page: Page, startTile: Tile): Promise<void> {
  await page.evaluate((initialTile) => {
    type MovementSample = {
      at: number;
      tile: Tile;
      moving: boolean;
      pending: boolean;
      heldDirection: string | null;
      queuedTaps: number;
      frame: string | null;
      foot: { x: number; y: number } | null;
      pose: { legA: number; legB: number; y: number } | null;
    };
    const trace = {
      samples: [] as MovementSample[],
      commits: [] as Array<{ at: number; tile: Tile }>,
      inputEvents: [] as Array<{ at: number; type: string; key: string; repeat: boolean }>,
      lastTile: initialTile,
    };
    (window as typeof window & { __continuousTenTile?: typeof trace }).__continuousTenTile = trace;
    window.addEventListener('keydown', (event) => {
      if (event.key.startsWith('Arrow')) trace.inputEvents.push({ at: performance.now(), type: 'keydown', key: event.key, repeat: event.repeat });
    }, true);
    window.addEventListener('keyup', (event) => {
      if (event.key.startsWith('Arrow')) trace.inputEvents.push({ at: performance.now(), type: 'keyup', key: event.key, repeat: event.repeat });
    }, true);
    const sample = (at: number) => {
      const debug = window.__dewhollow;
      const movement = debug?.movement();
      const actor = debug?.actors().find((item) => item.id === 'player');
      if (movement) {
        const tile = { x: movement.tile.x, y: movement.tile.y };
        if (tile.x !== trace.lastTile.x || tile.y !== trace.lastTile.y) {
          trace.commits.push({ at, tile });
          trace.lastTile = tile;
        }
        trace.samples.push({
          at,
          tile,
          moving: movement.moving,
          pending: movement.pending,
          heldDirection: movement.heldDirection,
          queuedTaps: movement.queuedTaps,
          frame: debug?.pixel32CandidateRuntime().playerFrame ?? null,
          foot: actor ? { x: actor.footX, y: actor.footY } : null,
          pose: actor ? { legA: actor.pose.legA, legB: actor.pose.legB, y: actor.pose.y } : null,
        });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, startTile);
}

async function waitForCommitCount(page: Page, count: number): Promise<void> {
  await page.waitForFunction((expected) => {
    const trace = (window as typeof window & { __continuousTenTile?: { commits: unknown[] } }).__continuousTenTile;
    return trace?.commits.length === expected;
  }, count, { timeout: 15_000 });
}

async function saveEvidence(testInfo: TestInfo, direction: typeof directions[number]['name'], evidence: Record<string, unknown>, screenshots: { held: Uint8Array; stopped: Uint8Array }): Promise<void> {
  const body = `${JSON.stringify(evidence, null, 2)}\n`;
  await testInfo.attach(`${direction}-continuous-10-tile-evidence.json`, { body, contentType: 'application/json' });
  await testInfo.attach(`${direction}-held-5-tiles.png`, { body: screenshots.held, contentType: 'image/png' });
  await testInfo.attach(`${direction}-after-release.png`, { body: screenshots.stopped, contentType: 'image/png' });
  if (!persistEvidence) return;
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const root = path.join(nodeProcess?.cwd() ?? '.', evidenceRoot);
  await fs.mkdir(path.join(root, 'screenshots'), { recursive: true });
  await fs.writeFile(path.join(root, `evidence-${direction}.json`), body);
  await fs.writeFile(path.join(root, 'screenshots', `${direction}-held-5-tiles.png`), screenshots.held);
  await fs.writeFile(path.join(root, 'screenshots', `${direction}-after-release.png`), screenshots.stopped);
}

for (const direction of directions) {
  test(`pixel32 candidate completes ten ${direction.name} tiles during one sustained hold and stops on release`, async ({ browser }, testInfo) => {
    test.setTimeout(90_000);
    const { context, page } = await startCandidateFarm(browser);
    try {
      const initial = await page.evaluate(() => window.__dewhollow!.movement().tile);
      expect({ x: initial.x, y: initial.y }).toEqual({ x: 20, y: 14 });
      await moveToOpenCenter(page);
      const start = await page.evaluate(() => window.__dewhollow!.movement().tile);
      await installCollector(page, start);
      await page.keyboard.down(direction.key);
      await waitForCommitCount(page, 5);
      const heldScreenshot = await page.screenshot({ animations: 'disabled', scale: 'css' });
      await waitForCommitCount(page, 10);
      await page.keyboard.up(direction.key);
      await waitForIdle(page);
      await page.waitForTimeout(500);
      const stoppedScreenshot = await page.screenshot({ animations: 'disabled', scale: 'css' });
      const trace = await page.evaluate(() => (window as typeof window & { __continuousTenTile?: unknown }).__continuousTenTile);
      expect(trace).toBeDefined();
      const parsed = trace as { commits: Array<{ at: number; tile: Tile }>; inputEvents: Array<{ at: number; type: string; key: string; repeat: boolean }>; samples: Array<{ frame: string | null; foot: { x: number; y: number } | null; pose: { legA: number; legB: number; y: number } | null; moving: boolean }> };
      expect(parsed.commits).toHaveLength(10);
      expect(parsed.inputEvents.map(({ type, key }) => [type, key])).toEqual([
        ['keydown', direction.key], ['keyup', direction.key],
      ]);
      const end = await page.evaluate(() => window.__dewhollow!.movement().tile);
      expect({ x: end.x, y: end.y }).toEqual({ x: start.x + direction.dx * 10, y: start.y + direction.dy * 10 });
      expect(parsed.samples.some((sample) => sample.moving && sample.frame?.startsWith(`${direction.name}-`) && !sample.frame.endsWith('-idle'))).toBe(true);
      expect(parsed.samples.every((sample) => sample.foot !== null && sample.pose !== null)).toBe(true);
      await saveEvidence(testInfo, direction.name, { direction: direction.name, initial: { x: initial.x, y: initial.y }, start, end: { x: end.x, y: end.y }, candidate: true, approved: false, trace: parsed }, { held: heldScreenshot, stopped: stoppedScreenshot });
    } finally {
      await context.close();
    }
  });
}
