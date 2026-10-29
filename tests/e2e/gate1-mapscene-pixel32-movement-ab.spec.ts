import { expect, test, type Page, type TestInfo } from '@playwright/test';

test.use({ video: 'on' });

const BASELINE = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation';
const SLOW = `${BASELINE}&gate1MovementSpeed=slow`;
const DIRECTIONS = [
  { name: 'right', key: 'ArrowRight' },
  { name: 'down', key: 'ArrowDown' },
  { name: 'left', key: 'ArrowLeft' },
  { name: 'up', key: 'ArrowUp' },
] as const;

interface Sample {
  atMs: number;
  phase: number;
  progress: number | null;
  frame: string;
}

interface StepEvidence {
  direction: typeof DIRECTIONS[number]['name'];
  elapsedMs: number;
  configuredDurationMs: number;
  samples: Sample[];
}

interface ProfileEvidence {
  name: 'baseline-150ms' | 'candidate-slow-240ms';
  configuredDurationMs: number;
  steps: StepEvidence[];
  screenshot: Uint8Array;
}

interface MovementDebug {
  movement(): {
    moving: boolean;
    pending: boolean;
    heldDirection: string | null;
    queuedTaps: number;
    tile: { x: number; y: number };
    stepProgress: number | null;
    stepElapsedMs: number | null;
    stepDurationMs: number;
    gaitPhase: number;
  };
  pixel32CandidateRuntime(): { enabled: boolean; playerFrame: string | null };
}

async function ready(page: Page, profile: string, expectedDurationMs: number): Promise<void> {
  await page.goto(profile);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().enabled ?? false)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().stepDurationMs ?? 0)).toBe(expectedDurationMs);
}

async function measureStep(page: Page, direction: typeof DIRECTIONS[number]): Promise<StepEvidence> {
  const recorderReady = page.waitForFunction(() => (window as typeof window & { __movementAbRecorderReady?: boolean }).__movementAbRecorderReady === true);
  const recorder = page.evaluate((directionName) => new Promise<StepEvidence>((resolve, reject) => {
    const debug = (window as unknown as { __dewhollow?: MovementDebug }).__dewhollow;
    if (!debug) return reject(new Error('缺少 movement debug API'));
    const browserState = window as typeof window & { __movementAbRecorderReady?: boolean };
    browserState.__movementAbRecorderReady = false;
    let startTile = { x: -1, y: -1 };
    const configuredDurationMs = debug.movement().stepDurationMs;
    const samples: Sample[] = [];
    const keyEvents: Array<{ type: string; key: string; target: string }> = [];
    const captureKey = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        keyEvents.push({ type: event.type, key: event.key, target: (event.target as Element | null)?.tagName ?? 'unknown' });
      }
    };
    window.addEventListener('keydown', captureKey, true);
    window.addEventListener('keyup', captureKey, true);
    let recordingStartedAt: number | null = null;
    let firstMovingAt: number | null = null;
    const sample = (now: number): void => {
      const movement = debug.movement();
      if (recordingStartedAt === null) {
        if (movement.moving || movement.pending || movement.heldDirection !== null) {
          requestAnimationFrame(sample);
          return;
        }
        startTile = { x: movement.tile.x, y: movement.tile.y };
        recordingStartedAt = now;
        browserState.__movementAbRecorderReady = true;
      }
      const frame = debug.pixel32CandidateRuntime().playerFrame ?? '';
      samples.push({
        atMs: now - recordingStartedAt,
        phase: movement.gaitPhase,
        progress: movement.stepProgress,
        frame,
      });
      if (movement.moving && firstMovingAt === null) firstMovingAt = now;
      const tileChanged = movement.tile.x !== startTile.x || movement.tile.y !== startTile.y;
      if (firstMovingAt !== null && tileChanged && !movement.moving && !movement.pending && movement.heldDirection === null) {
        window.removeEventListener('keydown', captureKey, true);
        window.removeEventListener('keyup', captureKey, true);
        browserState.__movementAbRecorderReady = false;
        resolve({
          direction: directionName as StepEvidence['direction'],
          elapsedMs: now - firstMovingAt,
          configuredDurationMs,
          samples,
        });
        return;
      }
      if (now - recordingStartedAt > 5_000) {
        const finalMovement = debug.movement();
        const tileChanged = finalMovement.tile.x !== startTile.x || finalMovement.tile.y !== startTile.y;
        window.removeEventListener('keydown', captureKey, true);
        window.removeEventListener('keyup', captureKey, true);
        browserState.__movementAbRecorderReady = false;
        reject(new Error(`等待 ${directionName} 移動完成逾時；samples=${samples.length}; firstMovingAtMs=${firstMovingAt === null ? 'none' : Math.round(firstMovingAt - recordingStartedAt)}; startTile=${JSON.stringify(startTile)}; finalMovement=${JSON.stringify(finalMovement)}; tileChanged=${tileChanged}; keyEvents=${JSON.stringify(keyEvents)}; lastFrame=${frame}`));
        return;
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }), direction.name);

  await recorderReady;
  await page.keyboard.press(direction.key);
  return recorder as Promise<StepEvidence>;
}

async function profile(page: Page, name: ProfileEvidence['name'], query: string, durationMs: number): Promise<ProfileEvidence> {
  await ready(page, query, durationMs);
  const steps: StepEvidence[] = [];
  for (const direction of DIRECTIONS) steps.push(await measureStep(page, direction));
  const screenshot = await page.screenshot({ animations: 'disabled', scale: 'css' });
  return { name, configuredDurationMs: durationMs, steps, screenshot };
}

async function saveEvidence(testInfo: TestInfo, evidence: Omit<ProfileEvidence, 'screenshot'>[], screenshots: Uint8Array[]): Promise<void> {
  const serialized = JSON.stringify(evidence, null, 2);
  await testInfo.attach('movement-speed-ab-evidence.json', { body: serialized, contentType: 'application/json' });
  await testInfo.attach('movement-baseline-150ms.png', { body: screenshots[0]!, contentType: 'image/png' });
  await testInfo.attach('movement-candidate-slow-240ms.png', { body: screenshots[1]!, contentType: 'image/png' });

  const runtime = globalThis as typeof globalThis & { process?: { cwd?: () => string; env?: Record<string, string | undefined> } };
  if (runtime.process?.env?.['SAVE_P4_044_EVIDENCE'] !== '1') return;
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const directory = path.join(runtime.process.cwd?.() ?? '.', 'docs/art/candidates/pixel-movement/gate1-movement-ab');
  await fs.mkdir(path.join(directory, 'screenshots'), { recursive: true });
  await fs.writeFile(path.join(directory, 'evidence.json'), `${serialized}\n`);
  await fs.writeFile(path.join(directory, 'screenshots', 'baseline-150ms.png'), screenshots[0]!);
  await fs.writeFile(path.join(directory, 'screenshots', 'candidate-slow-240ms.png'), screenshots[1]!);
}

test('Pixel32 movement A/B measures 150ms baseline and scheduler-synced 240ms candidate in all directions', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const baseline = await profile(page, 'baseline-150ms', BASELINE, 150);
  const candidate = await profile(page, 'candidate-slow-240ms', SLOW, 240);
  const screenshots = [baseline.screenshot, candidate.screenshot];
  await testInfo.attach('movement-speed-observations.json', {
    body: JSON.stringify([baseline, candidate].map(({ screenshot: _screenshot, ...result }) => result), null, 2),
    contentType: 'application/json',
  });

  for (const result of [baseline, candidate]) {
    expect(result.steps.map((step) => step.direction)).toEqual(['right', 'down', 'left', 'up']);
    for (const step of result.steps) {
      expect(step.configuredDurationMs).toBe(result.configuredDurationMs);
      // Headless SwiftShader frame pacing can stretch wall-clock time well beyond
      // the game scheduler duration; compare the two profiles below instead.
      expect(step.elapsedMs, `${result.name}/${step.direction}: ${JSON.stringify(step)}`).toBeGreaterThan(0);
      expect(new Set(step.samples.map(({ frame }) => frame).filter((frame) => frame.includes('contact') || frame.includes('passing'))).size).toBeGreaterThanOrEqual(2);
    }
  }

  const meanDuration = (result: ProfileEvidence): number => result.steps.reduce((sum, step) => sum + step.elapsedMs, 0) / result.steps.length;
  expect(meanDuration(candidate)).toBeGreaterThan(meanDuration(baseline) * 1.3);
  await saveEvidence(testInfo, [
    { name: baseline.name, configuredDurationMs: baseline.configuredDurationMs, steps: baseline.steps },
    { name: candidate.name, configuredDurationMs: candidate.configuredDurationMs, steps: candidate.steps },
  ], screenshots);
});
