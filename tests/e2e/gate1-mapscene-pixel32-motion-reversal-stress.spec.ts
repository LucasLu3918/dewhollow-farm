import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';

const evidenceRoot = 'docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-motion-reversal-stress';
const nodeProcess = (globalThis as typeof globalThis & { process?: { cwd(): string; env?: Record<string, string | undefined> } }).process;
const projectRoot = nodeProcess?.cwd() ?? '.';
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_EVIDENCE === '1';
const initialDirection: Direction = 'left';
const directions = ['left', 'up', 'down', 'right'] as const;
type Direction = typeof directions[number];
type Tile = { x: number; y: number };
type DirectionBatch = { expectedNext: Direction; reversals: number; crossTurns: number; inputs: Direction[] };

const opposite: Record<Direction, Direction> = {
  left: 'right',
  right: 'left',
  up: 'down',
  down: 'up',
};

function transitionKind(from: Direction, to: Direction): 'reverse' | 'cross' | 'same' {
  if (from === to) return 'same';
  if (opposite[from] === to) return 'reverse';
  return 'cross';
}

function createBatches(): DirectionBatch[] {
  const expectedNext: Direction[] = [
    'left', 'left', 'left', 'left', 'left', 'up', 'up', 'up', 'up', 'left',
  ];
  const crossTurnsPerBatch = [4, 6, 4, 6, 4, 5, 4, 6, 6, 5];
  let previous: Direction = initialDirection;

  const batches = expectedNext.map((end, index) => {
    const desiredCrossTurns = crossTurnsPerBatch[index]!;
    const desiredReversals = 10 - desiredCrossTurns;
    const memo = new Map<string, Direction[] | null>();

    const find = (remaining: number, last: Direction, reversals: number, crossTurns: number): Direction[] | null => {
      const key = `${remaining}:${last}:${reversals}:${crossTurns}`;
      if (memo.has(key)) return memo.get(key)!;
      if (remaining === 0) {
        const result = last === end && reversals === 0 && crossTurns === 0 ? [] : null;
        memo.set(key, result);
        return result;
      }

      for (const candidate of directions) {
        const kind = transitionKind(last, candidate);
        if (kind === 'same') continue;
        const nextReversals = reversals - Number(kind === 'reverse');
        const nextCrossTurns = crossTurns - Number(kind === 'cross');
        if (nextReversals < 0 || nextCrossTurns < 0) continue;
        const tail = find(remaining - 1, candidate, nextReversals, nextCrossTurns);
        if (tail) {
          const result = [candidate, ...tail];
          memo.set(key, result);
          return result;
        }
      }
      memo.set(key, null);
      return null;
    };

    const inputs = find(10, previous, desiredReversals, desiredCrossTurns);
    if (!inputs) throw new Error(`無法建立第 ${index + 1} 組固定反向／直角轉向序列`);
    previous = end;
    return { expectedNext: end, reversals: desiredReversals, crossTurns: desiredCrossTurns, inputs };
  });

  const transitions = batches.flatMap((batch) => batch.inputs);
  let prior: Direction = initialDirection;
  const totals = { reverse: 0, cross: 0, same: 0 };
  for (const direction of transitions) {
    totals[transitionKind(prior, direction)] += 1;
    prior = direction;
  }
  if (totals.reverse !== 50 || totals.cross !== 50 || totals.same !== 0) {
    throw new Error(`壓力輸入分類不符：${JSON.stringify(totals)}`);
  }
  return batches;
}

async function startCandidate(page: Page): Promise<void> {
  await page.goto('/?renderProfile=pixel32&gate1Runtime=pixel32-map-animation');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().enabled ?? false)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().playerVisible ?? false)).toBe(true);
}

async function currentTile(page: Page): Promise<Tile> {
  const tile = await page.evaluate(() => window.__dewhollow?.movement().tile ?? null);
  if (!tile) throw new Error('缺少玩家格位診斷');
  return { x: tile.x, y: tile.y };
}

async function installCollector(page: Page): Promise<void> {
  await page.evaluate(() => {
    type Sample = {
      at: number;
      tile: { x: number; y: number };
      moving: boolean;
      pending: boolean;
      queuedTaps: number;
      heldDirection: string | null;
      blockedDirection: string | null;
      frame: string | null;
      foot: { x: number; y: number } | null;
      busy: boolean;
    };
    const trace: { samples: Sample[]; inputEvents: Array<Record<string, unknown>>; collecting: boolean } = {
      samples: [],
      inputEvents: [],
      collecting: true,
    };
    (window as Window & { __motionStress?: typeof trace }).__motionStress = trace;

    const sample = (at: number) => {
      if (!trace.collecting) return;
      const movement = window.__dewhollow?.movement();
      const player = window.__dewhollow?.actors().find((actor) => actor.id === 'player');
      const runtime = window.__dewhollow?.pixel32CandidateRuntime();
      if (movement) {
        trace.samples.push({
          at,
          tile: movement.tile,
          moving: movement.moving,
          pending: movement.pending,
          queuedTaps: movement.queuedTaps,
          heldDirection: movement.heldDirection,
          blockedDirection: movement.blockedDirection,
          frame: runtime?.playerFrame ?? null,
          foot: player ? { x: player.footX, y: player.footY } : null,
          busy: player?.busy ?? false,
        });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function batch(page: Page, expectedBefore: Tile, inputs: Direction[], kickoff?: Direction): Promise<{
  beforeTile: Tile;
  lastInputAt: number;
  queueDepths: number[];
} | null> {
  return page.evaluate(({ expected, batchInputs, kickoffDirection }) => new Promise((resolve) => {
    const deadline = performance.now() + 10_000;
    const dispatchBatch = (movement: { tile: Tile; moving: boolean; pending: boolean }) => {
      if (movement.tile.x !== expected.x || movement.tile.y !== expected.y) {
        resolve(null);
        return;
      }
      if (!movement.moving && !movement.pending) return false;

      // Readiness and all key events run in one browser task, so the active
      // step cannot finish between the check and the first queued tap.
      const beforeTile = { x: movement.tile.x, y: movement.tile.y };
      let lastInputAt = 0;
      const queueDepths: number[] = [];
      for (const direction of batchInputs) {
        const key = ({ left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' } as const)[direction];
        const trace = (window as Window & { __motionStress?: { inputEvents: Array<Record<string, unknown>> } }).__motionStress;
        lastInputAt = performance.now();
        const record: Record<string, unknown> = { at: lastInputAt, direction, key, type: 'keydown' };
        trace?.inputEvents.push(record);
        window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        const afterKeydown = window.__dewhollow?.movement() ?? null;
        if (trace) record['stateAfterKeydown'] = afterKeydown;
        queueDepths.push(afterKeydown?.queuedTaps ?? 0);
        const upAt = performance.now();
        trace?.inputEvents.push({ at: upAt, direction, key, type: 'keyup' });
        window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
      }
      resolve({ beforeTile, lastInputAt, queueDepths });
      return true;
    };

    const sendKickoff = () => {
      if (!kickoffDirection) return;
      const key = ({ left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' } as const)[kickoffDirection];
      const trace = (window as Window & { __motionStress?: { inputEvents: Array<Record<string, unknown>> } }).__motionStress;
      const at = performance.now();
      const record: Record<string, unknown> = { at, direction: kickoffDirection, key, type: 'keydown' };
      trace?.inputEvents.push(record);
      window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      if (trace) record['stateAfterKeydown'] = window.__dewhollow?.movement() ?? null;
      trace?.inputEvents.push({ at: performance.now(), direction: kickoffDirection, key, type: 'keyup' });
      window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
    };

    const waitForStepAndDispatch = () => {
      const movement = window.__dewhollow?.movement();
      if (movement && dispatchBatch(movement) !== false) return;
      if (performance.now() >= deadline) {
        resolve(null);
        return;
      }
      requestAnimationFrame(waitForStepAndDispatch);
    };

    // The first movement step has no previous tap queued to start it. Inject its
    // kickoff and stress batch synchronously so CI scheduling cannot let that
    // 150 ms step settle before the first batch is queued.
    if (kickoffDirection) {
      sendKickoff();
      const movement = window.__dewhollow?.movement();
      if (movement && dispatchBatch(movement) !== false) return;
    }
    requestAnimationFrame(waitForStepAndDispatch);
  }), { expected: expectedBefore, batchInputs: inputs, kickoffDirection: kickoff });
}

async function waitForTile(page: Page, expected: Tile): Promise<void> {
  try {
    await page.waitForFunction(({ x, y }) => {
      const tile = window.__dewhollow?.movement().tile;
      return tile?.x === x && tile.y === y;
    }, expected, { timeout: 10_000 });
  } catch (cause) {
    const diagnostic = await page.evaluate(() => ({
      movement: window.__dewhollow?.movement() ?? null,
      player: window.__dewhollow?.actors().find((actor) => actor.id === 'player') ?? null,
      frame: window.__dewhollow?.pixel32CandidateRuntime().playerFrame ?? null,
      recentInputs: (window as Window & { __motionStress?: { inputEvents: Array<Record<string, unknown>> } }).__motionStress?.inputEvents.slice(-20) ?? [],
    }));
    throw new Error(`等待格位 ${expected.x},${expected.y} 逾時；目前狀態：${JSON.stringify(diagnostic)}`, { cause });
  }
}

test('pixel32 candidate survives 50 reversals and 50 cross-turns during ten committed tiles', async ({ browser }, testInfo: TestInfo) => {
  test.setTimeout(60_000);
  const crypto = await import('node:' + 'crypto');
  const fs = await import('node:' + 'fs/promises');
  const nodePath = await import('node:' + 'path');
  const context: BrowserContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const cryptoHash = (bytes: Uint8Array) => crypto.createHash('sha256').update(bytes).digest('hex');
  const batches = createBatches();
  const route: Tile[] = [
    { x: 6, y: 9 }, { x: 5, y: 9 }, { x: 4, y: 9 }, { x: 3, y: 9 }, { x: 2, y: 9 }, { x: 1, y: 9 },
    { x: 1, y: 8 }, { x: 1, y: 7 }, { x: 1, y: 6 }, { x: 1, y: 5 },
  ];
  const start = { x: 7, y: 9 };

  try {
    await startCandidate(page);
    await expect.poll(() => page.evaluate(() => {
      const tile = window.__dewhollow?.movement().tile;
      return tile ? { x: tile.x, y: tile.y } : null;
    })).toEqual(start);
    await installCollector(page);
    const startScreenshot = await page.screenshot({ animations: 'disabled', scale: 'css' });
    await testInfo.attach('pixel32-motion-stress-start.png', { body: startScreenshot, contentType: 'image/png' });

    const batchesEvidence: Array<{ index: number; expectedNext: Direction; lastInputAt: number; beforeTile: Tile; afterTile: Tile; queueDepths: number[] }> = [];

    for (const [index, inputBatch] of batches.entries()) {
      const before = route[index]!;
      const dispatched = await batch(page, before, inputBatch.inputs, index === 0 ? initialDirection : undefined);
      if (!dispatched) throw new Error(`無法在格位 ${before.x},${before.y} 的有效移動步驟中派發輸入`);
      expect(dispatched.beforeTile).toEqual(before);
      const { lastInputAt, queueDepths: depths } = dispatched;
      expect(depths).toHaveLength(10);
      expect(depths.every((depth) => depth === 1)).toBe(true);
      expect(Math.max(...depths)).toBeLessThanOrEqual(1);
      if (index < route.length - 1) {
        const expected = route[index + 1]!;
        await waitForTile(page, expected);
        const actual = await currentTile(page);
        expect(actual).toEqual(expected);
        expect(Math.abs(actual.x - before.x) + Math.abs(actual.y - before.y)).toBe(1);
        batchesEvidence.push({ index: index + 1, expectedNext: inputBatch.expectedNext, lastInputAt, beforeTile: before, afterTile: actual, queueDepths: depths });
      } else {
        await expect.poll(() => page.evaluate(({ x, y }) => {
          const movement = window.__dewhollow?.movement();
          return movement?.blockedDirection === 'left' && movement.tile.x === x && movement.tile.y === y;
        }, before), { timeout: 10_000 }).toBe(true);
        batchesEvidence.push({ index: index + 1, expectedNext: inputBatch.expectedNext, lastInputAt, beforeTile: before, afterTile: before, queueDepths: depths });
      }
    }

    await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().blockedDirection ?? null), { timeout: 10_000 }).toBe('left');
    await expect.poll(() => page.evaluate(() => {
      const movement = window.__dewhollow?.movement();
      return movement?.heldDirection === null && !movement.moving && !movement.pending && movement.queuedTaps === 0;
    }), { timeout: 10_000 }).toBe(true);
    const stopObservedAt = await page.evaluate(() => performance.now());
    await page.waitForFunction((startedAt) => performance.now() - startedAt >= 300, stopObservedAt);

    const sampled = await page.evaluate(() => {
      const trace = (window as Window & { __motionStress?: { samples: Array<{ at: number; tile: Tile; moving: boolean; pending: boolean; queuedTaps: number; heldDirection: string | null; blockedDirection: string | null; frame: string | null; foot: { x: number; y: number } | null; busy: boolean }>; inputEvents: Array<Record<string, unknown>>; collecting: boolean } }).__motionStress;
      if (!trace) throw new Error('缺少頁面取樣紀錄');
      trace.collecting = false;
      return { samples: trace.samples, inputEvents: trace.inputEvents };
    });
    const finalState = await page.evaluate(() => ({
      movement: window.__dewhollow?.movement() ?? null,
      actor: window.__dewhollow?.actors().find((item) => item.id === 'player') ?? null,
      runtime: window.__dewhollow?.pixel32CandidateRuntime() ?? null,
    }));

    const transitions = sampled.samples.reduce<Array<{ at: number; from: Tile; to: Tile; direction: Direction; frame: string | null; foot: { x: number; y: number } | null }>>((result, sample, index, all) => {
      const previousSample = all[index - 1];
      if (!previousSample || (sample.tile.x === previousSample.tile.x && sample.tile.y === previousSample.tile.y)) return result;
      const dx = sample.tile.x - previousSample.tile.x;
      const dy = sample.tile.y - previousSample.tile.y;
      const direction: Direction = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
      result.push({
        at: sample.at,
        from: { x: previousSample.tile.x, y: previousSample.tile.y },
        to: { x: sample.tile.x, y: sample.tile.y },
        direction,
        frame: sample.frame,
        foot: sample.foot,
      });
      return result;
    }, []);
    expect(transitions).toHaveLength(10);
    expect(transitions.map(({ to }) => to)).toEqual(route);
    expect(finalState.movement).toMatchObject({ tile: { x: 1, y: 5 }, heldDirection: null, blockedDirection: 'left', moving: false, pending: false, queuedTaps: 0 });
    expect(finalState.actor).toMatchObject({ tileX: 1, tileY: 5, busy: false });
    expect(finalState.actor?.footX).toBeCloseTo(96, 0);
    expect(finalState.actor?.footY).toBeCloseTo(384, 0);
    expect(finalState.runtime).toMatchObject({ enabled: true, playerVisible: true });

    const observedFrames = [...new Set(sampled.samples.map(({ frame }) => frame).filter((frame): frame is string => frame !== null))];
    for (const direction of ['left', 'up'] as const) {
      expect(observedFrames.some((frame) => frame.startsWith(`${direction}-`) && !frame.endsWith('-idle'))).toBe(true);
    }
    const feet = sampled.samples.map(({ foot }) => foot).filter((foot): foot is { x: number; y: number } => foot !== null);
    expect(feet.length).toBeGreaterThan(20);
    expect(Math.min(...feet.map(({ x }) => x))).toBeGreaterThanOrEqual(95);
    expect(Math.max(...feet.map(({ x }) => x))).toBeLessThanOrEqual(481);
    expect(Math.min(...feet.map(({ y }) => y))).toBeGreaterThanOrEqual(383);
    expect(Math.max(...feet.map(({ y }) => y))).toBeLessThanOrEqual(641);
    const lateSamples = sampled.samples.filter(({ at }) => at >= stopObservedAt);
    expect(lateSamples.length).toBeGreaterThanOrEqual(15);
    expect(lateSamples.at(-1)!.at - lateSamples[0]!.at).toBeGreaterThanOrEqual(250);
    expect(new Set(lateSamples.map(({ tile }) => `${tile.x},${tile.y}`)).size).toBe(1);
    expect(new Set(lateSamples.map(({ foot }) => foot ? `${foot.x.toFixed(2)},${foot.y.toFixed(2)}` : 'missing')).size).toBe(1);
    expect(new Set(lateSamples.map(({ frame }) => frame)).size).toBe(1);
    expect(lateSamples.every(({ busy }) => !busy)).toBe(true);

    const inputDirections = batches.flatMap(({ inputs }) => inputs);
    let previousDirection: Direction = initialDirection;
    const classifiedInputs = inputDirections.map((direction, index) => {
      const kind = transitionKind(previousDirection, direction);
      const item = { index: index + 1, direction, transition: kind };
      previousDirection = direction;
      return item;
    });
    expect(classifiedInputs.filter(({ transition }) => transition === 'reverse')).toHaveLength(50);
    expect(classifiedInputs.filter(({ transition }) => transition === 'cross')).toHaveLength(50);
    expect(classifiedInputs.filter(({ transition }) => transition === 'same')).toHaveLength(0);

    const inputToCommitLatencyMs = batchesEvidence.map((entry, index) => {
      const transition = transitions[index + 1];
      return transition ? transition.at - entry.lastInputAt : null;
    }).filter((latency): latency is number => latency !== null);
    const sortedLatency = [...inputToCommitLatencyMs].sort((a, b) => a - b);
    const latency = {
      definition: 'last synthetic keydown in each in-step batch to the first requestAnimationFrame sample observing the next committed tile; browser-side observation only',
      samples: sortedLatency.length,
      minMs: sortedLatency[0] ?? null,
      medianMs: sortedLatency.length ? sortedLatency[Math.floor(sortedLatency.length / 2)] : null,
      maxMs: sortedLatency.at(-1) ?? null,
    };
    const finalScreenshot = await page.screenshot({ animations: 'disabled', scale: 'css' });
    await testInfo.attach('pixel32-motion-stress-stopped.png', { body: finalScreenshot, contentType: 'image/png' });

    const animationManifestPath = 'docs/art/candidates/pixel-movement/gate1-assets/pixel32-animation/manifest.json';
    const animationManifestBytes = await fs.readFile(nodePath.resolve(projectRoot, animationManifestPath));
    const animationManifest = JSON.parse(animationManifestBytes.toString('utf8')) as { status: string; approved: boolean; atlas: { file: string; sha256: string } };
    const atlasPath = nodePath.join(nodePath.dirname(animationManifestPath), animationManifest.atlas.file);
    const atlasBytes = await fs.readFile(nodePath.resolve(projectRoot, atlasPath));
    const specBytes = await fs.readFile(nodePath.resolve(projectRoot, 'tests/e2e/gate1-mapscene-pixel32-motion-reversal-stress.spec.ts'));
    expect(animationManifest).toMatchObject({ status: 'candidate', approved: false });

    const evidence = {
      task: 'DF-G1-MOTION-REVERSAL-STRESS',
      status: 'candidate-only browser evidence; does not pass Gate 1',
      capturedAt: new Date().toISOString(),
      environment: { browser: 'Playwright Chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, route: '/?renderProfile=pixel32&gate1Runtime=pixel32-map-animation' },
      route: { start, committedTiles: [start, ...route], successfulTransitions: transitions.length, blockedAttempt: { direction: 'left', tileRemained: { x: 1, y: 5 } } },
      inputStress: {
        definition: 'one directional intent is one synthetic keydown/keyup tap; reversal means the next intent is opposite the previous intent; cross-turn means it is perpendicular; each batch is dispatched synchronously within one in-flight 150ms step and latest-tap-wins selects the next tile direction',
        kickoff: { tapCount: 1, direction: initialDirection, includedInStressIntentCount: false },
        directionIntents: inputDirections.length,
        reversals: classifiedInputs.filter(({ transition }) => transition === 'reverse').length,
        crossTurns: classifiedInputs.filter(({ transition }) => transition === 'cross').length,
        batches: batches.map(({ expectedNext, reversals, crossTurns, inputs }) => ({ expectedNext, reversals, crossTurns, inputs })),
        classifiedInputs,
        rawEvents: sampled.inputEvents,
        queueDepthMaxObserved: Math.max(...batchesEvidence.flatMap(({ queueDepths }) => queueDepths)),
      },
      transitions,
      samples: sampled.samples,
      frameEvidence: { uniqueFrames: observedFrames, finalFrame: finalState.runtime?.playerFrame ?? null },
      anchorEvidence: { sampleCount: feet.length, bounds: { minX: Math.min(...feet.map(({ x }) => x)), maxX: Math.max(...feet.map(({ x }) => x)), minY: Math.min(...feet.map(({ y }) => y)), maxY: Math.max(...feet.map(({ y }) => y)) }, finalFoot: finalState.actor ? { x: finalState.actor.footX, y: finalState.actor.footY } : null },
      stopStability: { observedForMs: lateSamples.at(-1)!.at - lateSamples[0]!.at, rafSamples: lateSamples.length },
      latency,
      stopState: finalState.movement,
      hashes: {
        test: cryptoHash(specBytes),
        animationManifest: cryptoHash(animationManifestBytes),
        animationAtlas: cryptoHash(atlasBytes),
        manifestDeclaredAtlas: animationManifest.atlas.sha256,
        screenshots: { start: { sha256: cryptoHash(startScreenshot), bytes: startScreenshot.byteLength }, stopped: { sha256: cryptoHash(finalScreenshot), bytes: finalScreenshot.byteLength } },
      },
      limitations: [
        '合成鍵盤事件在單一瀏覽器頁面同步派送；未包含作業系統、硬體鍵盤或真實使用者輸入延遲。',
        '延遲為輸入事件到 RAF 首次觀測 committed tile 的瀏覽器端量測，不代表畫面完成轉向或主觀回應時間。',
        'Chromium 取樣不驗收實機、觸控、60／120 FPS、原生 DPR 光柵、動作美術品質或 Gate 1。',
        '動畫幀記錄是 RAF 取樣，短幀可能被取樣跳過；latest-tap queue 對每個步進只保留最後方向。',
      ],
    };
    const reportBody = `${JSON.stringify(evidence, null, 2)}\n`;
    await testInfo.attach('pixel32-motion-reversal-stress-evidence.json', { body: reportBody, contentType: 'application/json' });

    if (saveEvidence) {
      const outputDirectory = nodePath.resolve(projectRoot, evidenceRoot);
      await fs.mkdir(nodePath.join(outputDirectory, 'screenshots'), { recursive: true });
      await fs.writeFile(nodePath.join(outputDirectory, 'screenshots', 'motion-start-390x844.png'), startScreenshot);
      await fs.writeFile(nodePath.join(outputDirectory, 'screenshots', 'motion-stopped-390x844.png'), finalScreenshot);
      await fs.writeFile(nodePath.join(outputDirectory, 'evidence.json'), reportBody);
    }
  } finally {
    await context.close();
  }
});
